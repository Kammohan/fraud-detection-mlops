# Real-Time Fraud Detection — MLOps Pipeline

A production-grade microservices system that detects credit card fraud in real time. Transactions stream through Apache Kafka at 50 per second, get scored by a pre-trained XGBoost model, and results are persisted to PostgreSQL and surfaced on a live React dashboard — all running across 5 Docker containers with a single command.

**Live metrics as of last run:** 96,000+ transactions scored · 162 fraud cases flagged · 0.168% fraud rate · ROC-AUC 0.9747

---

## What This Demonstrates

- **Event-driven architecture** — services communicate through Kafka, not direct API calls, so each component is independently deployable and failure-isolated
- **ML in production** — a trained model served behind an API, not a notebook. Handles class imbalance, feature scaling, and threshold calibration the way a real ML platform team would
- **Audit compliance** — every model decision is written to an append-only PostgreSQL ledger with a timestamp, which is a regulatory requirement in financial services
- **Operational visibility** — a live dashboard showing throughput, score distribution, and fraud alerts so an ops team can monitor the system without touching the database

---

## Architecture

```
creditcard.csv
     │
     ▼
┌─────────────┐     JSON messages      ┌─────────────┐    scored results    ┌──────────────┐
│  Producer   │ ──────────────────────▶│    Kafka    │─────────────────────▶│  Inference   │
│  (Python)   │    50 transactions/sec │  (KRaft)    │  consumer group poll │  (FastAPI +  │
└─────────────┘                        └─────────────┘                      │   XGBoost)   │
                                                                             └──────┬───────┘
                                                                                    │
                                                                         writes every result
                                                                                    │
                                                                             ┌──────▼───────┐
                                                                             │  PostgreSQL  │
                                                                             │ (audit ledger│
                                                                             └──────┬───────┘
                                                                                    │
                                                                           REST API (FastAPI)
                                                                                    │
                                                                             ┌──────▼───────┐
                                                                             │   Dashboard  │
                                                                             │   (React)    │
                                                                             └──────────────┘
```

---

## The 5 Containers

### Container 1 — Apache Kafka (KRaft mode)
The message broker at the center of the pipeline. Every transaction flows through Kafka before anything else touches it.

- Runs in **KRaft mode** — Kafka's modern self-managed metadata system that eliminates the Zookeeper dependency required in older versions
- `live-transactions` topic with **3 partitions** for parallel consumption
- Internal broker address (`kafka:29092`) used by containers; host address (`localhost:9092`) available for debugging
- Health-checked before downstream services are allowed to start

### Container 2 — Data Producer (Python)
Simulates a live card network feeding transactions into the system.

- Reads the **Kaggle Credit Card Fraud dataset** (284,807 real transactions, anonymized via PCA)
- Streams rows into Kafka at exactly **50 transactions per second** using a monotonic clock for precision rate limiting
- Each row is serialized to JSON and assigned a UUID transaction ID and UTC timestamp
- When the dataset is exhausted it loops back to row 1 — the pipeline runs indefinitely
- Handles `SIGTERM` gracefully, flushing any in-flight messages before shutdown

### Container 3 — Inference Engine (FastAPI + XGBoost)
The core of the system. Consumes messages, scores them, stores results.

- Loads `model.pkl` into memory at startup — one load, zero latency on every subsequent inference
- Kafka consumer joins group `inference-engine` and polls messages continuously
- Each transaction is deserialized, features are scaled with the same `StandardScaler` used during training, then passed to `model.predict_proba()` — the output is the fraud probability from 0.0 to 1.0
- Transactions with a score **above 0.85** are flagged. This threshold was deliberately set higher than the default 0.5 to minimize false positives — flagging a legitimate transaction erodes customer trust
- Every result (score, flag, amount, timestamp) is written to PostgreSQL
- Exposes a **FastAPI REST API** on port 8000 that the dashboard queries every second
- A background thread purges rows older than 24 hours every 5 minutes to keep the database bounded

### Container 4 — PostgreSQL
The compliance layer.

- Stores every scored transaction: `transaction_id`, `amount`, `fraud_score`, `flagged`, `timestamp`
- Data persists across container restarts via a **named Docker volume** — stopping and restarting the stack does not lose history
- `created_at` is indexed for fast purge queries
- In a real deployment this would also feed a data warehouse for model retraining and drift detection

### Container 5 — React Dashboard
Live monitoring interface.

- Polls `/metrics`, `/transactions/recent`, `/metrics/history`, and `/metrics/distribution` every second
- **Transaction volume chart** — area chart of throughput per minute over the last 20 minutes
- **Score distribution chart** — bar chart showing where model scores cluster across all transactions. In a well-performing model, the vast majority of scores should be near 0 (legitimate) with a small cluster near 1 (fraud). This chart validates that in real time.
- **Model metadata strip** — algorithm, feature count, class imbalance ratio, threshold rationale, precision/recall/F1/ROC-AUC all visible without opening a notebook
- **Live transaction feed** — color-coded rows with a visual risk bar per transaction
- **Fraud alerts panel** — each flagged transaction shown with amount, model confidence percentage, and time since detection

---

## The ML Model

**Algorithm:** XGBoost (gradient boosted decision trees)

**Dataset:** [Kaggle Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) — 284,807 transactions, 492 fraud cases (0.173%)

**Features:**
- `V1`–`V28` — the dataset publisher (a European bank) applied PCA to the original transaction features before releasing the data, to protect cardholder privacy. This pipeline consumes those pre-transformed components as plain numerical inputs — no PCA is performed here.
- `Amount` — transaction value in euros, standardized with `StandardScaler` at inference time to match the training distribution
- `Time` — seconds elapsed from the first transaction in the dataset, standardized

**The class imbalance problem:**
Only 0.173% of transactions are fraud — a 577:1 ratio. A naive model that predicts "legitimate" for every transaction would achieve 99.83% accuracy while catching zero fraud cases. Accuracy is a useless metric here.

The fix: XGBoost's `scale_pos_weight` parameter, set to 577, which internally weights the minority class (fraud) to correct for this imbalance during training. This is equivalent to oversampling fraud cases 577 times without actually duplicating data.

**Why the threshold is 0.85, not 0.5:**
The default binary classification threshold of 0.5 maximizes overall accuracy. But in fraud detection, the costs are asymmetric — a missed fraud case costs far more than a false alarm. The threshold was raised to 0.85 to reduce false positives and flag only high-confidence fraud, accepting a slightly lower recall in exchange for higher precision. In production this threshold would be tuned against business cost functions, not just statistical metrics.

**Evaluation on held-out test set (20% of data, 56,962 transactions):**

| Metric | Value | What it means |
|--------|-------|---------------|
| ROC-AUC | **0.9747** | Near-perfect separation between fraud and legitimate transactions across all possible thresholds |
| Precision | **78%** | When the model flags a transaction as fraud, it's correct 78% of the time |
| Recall | **84%** | The model catches 84 out of every 100 real fraud cases |
| F1 Score | **0.81** | Harmonic mean of precision and recall — the right metric for imbalanced classification |
| Accuracy | ~99.9% | Meaningless on this dataset — included only to illustrate why accuracy is the wrong metric |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Message broker | Apache Kafka (KRaft) | Industry standard for real-time event streaming. KRaft mode removes the Zookeeper operational burden. |
| ML model | XGBoost | State-of-the-art gradient boosting. Handles tabular data and class imbalance better than most alternatives. |
| Inference API | FastAPI (Python) | Async framework that runs the Kafka consumer thread and HTTP server in the same process. |
| Database | PostgreSQL 16 | Battle-tested relational store. Named volume ensures data survives container restarts. |
| Orchestration | Docker Compose | Health checks and `depends_on` conditions guarantee correct startup order. One command to run everything. |
| Frontend | React + Vite + Recharts | Lightweight SPA with 1-second polling. Recharts for the score distribution and volume charts. |
| Styling | Tailwind CSS | Utility-first CSS for rapid UI development without a design system. |

---

## Running Locally

**Prerequisites:** Docker Desktop

```bash
# Clone the repo
git clone https://github.com/Kammohan/fraud-detection-mlops.git
cd fraud-detection-mlops

# Download the dataset (requires Kaggle account)
pip install kagglehub
python3 -c "
import kagglehub, shutil
path = kagglehub.dataset_download('mlg-ulb/creditcardfraud')
shutil.copy(f'{path}/creditcard.csv', 'data/creditcard.csv')
"

# Train the model
pip install xgboost scikit-learn pandas
python3 train.py

# Start all 5 containers
docker compose up -d

# Open the dashboard
open http://localhost:3000
```

The full pipeline is live in about 30 seconds. To stop:
```bash
docker compose down        # stops containers, preserves database
docker compose down -v     # stops containers and deletes database
```

**Service endpoints:**
| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Live monitoring UI |
| FastAPI | http://localhost:8000 | Inference + metrics REST API |
| FastAPI Docs | http://localhost:8000/docs | Auto-generated API documentation |
| Kafka | localhost:9092 | Bootstrap server (for local tools) |

---

## Project Structure

```
fraud-detection-mlops/
├── docker-compose.yml        # All 5 services, health checks, networks
├── train.py                  # XGBoost training script → model.pkl
│
├── producer/
│   ├── producer.py           # Kafka producer, rate limiting, CSV streaming
│   ├── Dockerfile
│   └── requirements.txt
│
├── inference/
│   ├── main.py               # FastAPI app, Kafka consumer, XGBoost scoring
│   ├── Dockerfile
│   └── requirements.txt
│
├── dashboard/
│   ├── src/
│   │   ├── Home.jsx          # Landing page with pipeline walkthrough
│   │   └── App.jsx           # Live monitoring dashboard
│   ├── Dockerfile            # Multi-stage: Node build → nginx serve
│   └── nginx.conf
│
└── data/                     # Place creditcard.csv here (gitignored)
```

---

## Key Design Decisions

**Why Kafka instead of direct API calls?**
If the inference engine goes down, a direct API call from the producer would fail and lose that transaction. With Kafka, messages are durably stored in the broker. When inference comes back up, it resumes from where it left off — no data loss. This is the core value proposition of event-driven architecture.

**Why a separate init container for topic creation?**
Kafka's `kafka-init` service creates the `live-transactions` topic on first boot and exits. This keeps topic configuration declarative and reproducible, rather than relying on `auto.create.topics.enable` which would silently create topics from typos.

**Why PostgreSQL instead of just Kafka?**
Kafka is not a database — it's a log with a retention window. PostgreSQL provides the queryable, indexed, long-term store that a compliance audit trail requires. The dashboard queries Postgres, not Kafka, which keeps the consumer group offsets clean and query latency low.

**Why threshold 0.85 instead of 0.5?**
At 0.5, the model flags more transactions but with lower confidence — more false positives. At 0.85, every flag is high-confidence fraud. For a customer-facing card product, a false positive (blocking a legitimate purchase) is a significant UX failure. The threshold reflects that asymmetry.

---

## What Would Be Added in Production

- **Model versioning** — MLflow or similar to track experiments, compare models, and roll back
- **Feature store** — centralized, low-latency feature serving so training and inference use identical feature pipelines
- **Model drift monitoring** — alert when the live fraud rate or score distribution drifts significantly from baseline
- **A/B testing infrastructure** — shadow mode to test new models against production traffic before promoting
- **Kafka Schema Registry** — enforce message schemas so a bad producer can't break the consumer
- **Kubernetes** — replace Docker Compose for horizontal scaling, rolling deploys, and self-healing
- **CI/CD pipeline** — automated retraining triggered by data drift, with test gates before deployment
