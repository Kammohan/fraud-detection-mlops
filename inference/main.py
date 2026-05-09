import json
import os
import pickle
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import psycopg2
import psycopg2.extras
from confluent_kafka import Consumer, KafkaError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Config ────────────────────────────────────────────────────────────────────
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
TOPIC             = os.getenv("KAFKA_TOPIC", "live-transactions")
GROUP_ID          = os.getenv("KAFKA_GROUP_ID", "inference-engine")
MODEL_PATH        = os.getenv("MODEL_PATH", "/app/model.pkl")
METRICS_PATH      = os.getenv("METRICS_PATH", "/app/model_metrics.json")
FRAUD_THRESHOLD   = float(os.getenv("FRAUD_THRESHOLD", "0.85"))

DB_HOST = os.getenv("POSTGRES_HOST", "postgres")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "fraud")
DB_USER = os.getenv("POSTGRES_USER", "fraud")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "fraud")

FEATURE_COLS = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]

# ── Load model ────────────────────────────────────────────────────────────────
with open(MODEL_PATH, "rb") as f:
    bundle = pickle.load(f)
model   = bundle["model"]
scaler  = bundle["scaler"]
print(f"[INFO] Model loaded from {MODEL_PATH}", flush=True)

# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS,
    )

RETENTION_HOURS = int(os.getenv("RETENTION_HOURS", "24"))

def init_db():
    conn = get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id              SERIAL PRIMARY KEY,
                    transaction_id  TEXT NOT NULL,
                    amount          NUMERIC(12,2),
                    fraud_score     NUMERIC(6,4),
                    flagged         BOOLEAN,
                    timestamp       TIMESTAMPTZ,
                    created_at      TIMESTAMPTZ DEFAULT now()
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at)")
    conn.close()
    print("[INFO] DB schema ready", flush=True)

def purge_old_rows():
    while True:
        time.sleep(300)  # run every 5 minutes
        try:
            conn = get_conn()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM transactions WHERE created_at < NOW() - INTERVAL '%s hours'",
                        (RETENTION_HOURS,)
                    )
                    deleted = cur.rowcount
            conn.close()
            if deleted:
                print(f"[INFO] Purged {deleted:,} rows older than {RETENTION_HOURS}h", flush=True)
        except Exception as e:
            print(f"[ERROR] Purge failed: {e}", flush=True)

def insert_transaction(tx_id, amount, score, flagged, ts):
    conn = get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO transactions
                   (transaction_id, amount, fraud_score, flagged, timestamp)
                   VALUES (%s, %s, %s, %s, %s)""",
                (tx_id, amount, score, flagged, ts),
            )
    conn.close()

# ── Inference ─────────────────────────────────────────────────────────────────
def score(row: dict) -> float:
    df = pd.DataFrame([row])[FEATURE_COLS].astype(float)
    df[["Amount", "Time"]] = scaler.transform(df[["Amount", "Time"]])
    return float(model.predict_proba(df)[0][1])

# ── Kafka consumer loop (runs in background thread) ───────────────────────────
stats = {"processed": 0, "flagged": 0, "total_score": 0.0}
stats_lock = threading.Lock()

def consume_loop():
    consumer = Consumer({
        "bootstrap.servers": BOOTSTRAP_SERVERS,
        "group.id": GROUP_ID,
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
    })
    consumer.subscribe([TOPIC])
    print(f"[INFO] Kafka consumer subscribed to {TOPIC}", flush=True)

    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                print(f"[ERROR] {msg.error()}", flush=True)
            continue

        try:
            row = json.loads(msg.value().decode())
            fraud_score = score(row)
            flagged     = fraud_score >= FRAUD_THRESHOLD
            tx_id       = row.get("transaction_id", str(uuid.uuid4()))
            amount      = float(row.get("Amount", 0))
            ts          = row.get("timestamp", datetime.now(timezone.utc).isoformat())

            insert_transaction(tx_id, amount, fraud_score, flagged, ts)

            with stats_lock:
                stats["processed"] += 1
                stats["flagged"]   += int(flagged)
                stats["total_score"] += fraud_score

            if flagged:
                print(f"[FRAUD] tx={tx_id[:8]} amount=${amount:.2f} score={fraud_score:.4f}", flush=True)

        except Exception as e:
            print(f"[ERROR] Failed to process message: {e}", flush=True)

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Fraud Detection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    threading.Thread(target=consume_loop, daemon=True).start()
    threading.Thread(target=purge_old_rows, daemon=True).start()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*)                            AS total_processed,
                SUM(flagged::int)                   AS total_flagged,
                COALESCE(AVG(fraud_score), 0)       AS avg_fraud_score
            FROM transactions
        """)
        row = cur.fetchone()
    conn.close()
    processed = int(row[0])
    flagged   = int(row[1]) if row[1] else 0
    avg_score = float(row[2])
    return {
        "total_processed": processed,
        "total_flagged":   flagged,
        "fraud_rate_pct":  round(flagged / processed * 100, 3) if processed else 0.0,
        "avg_fraud_score": round(avg_score, 4),
    }

@app.get("/transactions/recent")
def recent_transactions(limit: int = 50):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT transaction_id, amount, fraud_score, flagged, timestamp
               FROM transactions
               ORDER BY created_at DESC
               LIMIT %s""",
            (min(limit, 200),),
        )
        rows = cur.fetchall()
    conn.close()
    return {"transactions": [dict(r) for r in rows]}

@app.get("/metrics/history")
def metrics_history():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                to_char(date_trunc('minute', created_at), 'HH24:MI') AS minute,
                COUNT(*)                  AS count,
                SUM(flagged::int)         AS flagged
            FROM transactions
            WHERE created_at > NOW() - INTERVAL '20 minutes'
            GROUP BY date_trunc('minute', created_at), minute
            ORDER BY date_trunc('minute', created_at)
        """)
        rows = cur.fetchall()
    conn.close()
    return {"history": [{"minute": r[0], "count": int(r[1]), "flagged": int(r[2])} for r in rows]}

@app.get("/metrics/distribution")
def score_distribution():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                (FLOOR(fraud_score * 10) / 10)::numeric(3,1) AS bucket,
                COUNT(*) AS count
            FROM transactions
            GROUP BY bucket
            ORDER BY bucket
        """)
        rows = cur.fetchall()
    conn.close()
    buckets = {f"{i/10:.1f}": 0 for i in range(10)}
    for r in rows:
        buckets[f"{float(r[0]):.1f}"] = int(r[1])
    return {"distribution": [{"bucket": k, "count": v} for k, v in buckets.items()]}

@app.get("/model/metrics")
def model_metrics():
    p = Path(METRICS_PATH)
    if not p.exists():
        return {}
    return json.loads(p.read_text())

@app.get("/transactions/fraud")
def fraud_alerts(limit: int = 20):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT transaction_id, amount, fraud_score, timestamp
               FROM transactions
               WHERE flagged = true
               ORDER BY created_at DESC
               LIMIT %s""",
            (min(limit, 100),),
        )
        rows = cur.fetchall()
    conn.close()
    return {"alerts": [dict(r) for r in rows]}
