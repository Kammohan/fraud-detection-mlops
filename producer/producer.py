import csv
import json
import os
import signal
import sys
import time
import uuid
from datetime import datetime, timezone

from confluent_kafka import Producer

BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
TOPIC = os.getenv("KAFKA_TOPIC", "live-transactions")
RATE_PER_SEC = float(os.getenv("RATE_PER_SEC", "50"))
CSV_PATH = os.getenv("CSV_PATH", "/app/data/creditcard.csv")
LOG_INTERVAL = int(os.getenv("LOG_INTERVAL", "500"))

running = True


def handle_signal(sig, frame):
    global running
    print("\n[INFO] Shutdown signal received, flushing producer...", flush=True)
    running = False


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def delivery_report(err, msg):
    if err is not None:
        print(f"[ERROR] Delivery failed key={msg.key()}: {err}", file=sys.stderr, flush=True)


def main():
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] CSV not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    producer = Producer({
        "bootstrap.servers": BOOTSTRAP_SERVERS,
        "linger.ms": 5,
        "batch.size": 16384,
    })

    interval = 1.0 / RATE_PER_SEC
    sent = 0
    start = time.monotonic()

    print(
        f"[INFO] Producer started | topic={TOPIC} | bootstrap={BOOTSTRAP_SERVERS} | rate={RATE_PER_SEC:.0f} tx/sec",
        flush=True,
    )

    while running:
        with open(CSV_PATH, newline="") as f:
            reader = csv.DictReader(f)
            next_send = time.monotonic()

            for row in reader:
                if not running:
                    break

                tx_id = str(uuid.uuid4())
                row["transaction_id"] = tx_id
                row["timestamp"] = datetime.now(timezone.utc).isoformat()

                producer.produce(
                    TOPIC,
                    key=tx_id.encode(),
                    value=json.dumps(row).encode(),
                    on_delivery=delivery_report,
                )
                producer.poll(0)
                sent += 1

                if sent % LOG_INTERVAL == 0:
                    elapsed = time.monotonic() - start
                    print(f"[INFO] Sent {sent:,} messages | actual={sent / elapsed:.1f} tx/sec", flush=True)

                next_send += interval
                sleep_time = next_send - time.monotonic()
                if sleep_time > 0:
                    time.sleep(sleep_time)

        if running:
            print(f"[INFO] CSV exhausted ({sent:,} total), looping back to row 1...", flush=True)

    producer.flush()
    elapsed = time.monotonic() - start
    print(f"[INFO] Producer stopped | total={sent:,} | avg={sent / elapsed:.1f} tx/sec", flush=True)


if __name__ == "__main__":
    main()
