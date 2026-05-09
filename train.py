import json
import pickle
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, roc_auc_score,
    roc_curve, precision_recall_curve, average_precision_score,
    confusion_matrix,
)
from sklearn.preprocessing import StandardScaler

CSV_PATH    = "data/creditcard.csv"
MODEL_PATH  = "model.pkl"
METRICS_PATH = "model_metrics.json"

print("[1/6] Loading data...")
df = pd.read_csv(CSV_PATH)
print(f"      {len(df):,} rows | fraud rate: {df['Class'].mean()*100:.3f}%")

print("[2/6] Preparing features...")
X = df.drop(columns=["Class"])
y = df["Class"]

scaler = StandardScaler()
X = X.copy()
X[["Amount", "Time"]] = scaler.fit_transform(X[["Amount", "Time"]])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

fraud_ratio = (y_train == 0).sum() / (y_train == 1).sum()
print(f"      Train: {len(X_train):,} rows | Test: {len(X_test):,} rows")
print(f"      scale_pos_weight = {fraud_ratio:.1f}")

print("[3/6] Training XGBoost (capturing learning curve)...")
model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    scale_pos_weight=fraud_ratio,
    eval_metric="aucpr",
    random_state=42,
    n_jobs=-1,
)
model.fit(
    X_train, y_train,
    eval_set=[(X_train, y_train), (X_test, y_test)],
    verbose=False,
)
evals = model.evals_result()
train_aucpr = evals["validation_0"]["aucpr"]
test_aucpr  = evals["validation_1"]["aucpr"]

print("[4/6] Evaluating...")
y_prob = model.predict_proba(X_test)[:, 1]
y_pred = (y_prob >= 0.85).astype(int)

auc    = roc_auc_score(y_test, y_prob)
ap     = average_precision_score(y_test, y_prob)
fpr, tpr, _       = roc_curve(y_test, y_prob)
prec, rec, _      = precision_recall_curve(y_test, y_prob)
cm                = confusion_matrix(y_test, y_pred)
tn, fp, fn, tp    = cm.ravel()

print(f"      ROC-AUC: {auc:.4f} | Avg Precision: {ap:.4f}")
print(classification_report(y_test, y_pred, target_names=["legit", "fraud"]))

# Downsample curves to 120 points for compact JSON
def downsample(arr, n=120):
    idx = np.round(np.linspace(0, len(arr) - 1, n)).astype(int)
    return np.array(arr)[idx].tolist()

print("[5/6] Computing feature importance...")
importance = sorted(
    zip(X.columns.tolist(), model.feature_importances_.tolist()),
    key=lambda x: x[1], reverse=True
)

# Score distribution on test set
fraud_scores = y_prob[y_test == 1].tolist()
legit_scores  = y_prob[y_test == 0].tolist()
# Downsample legit scores (56k points → 500)
rng = np.random.default_rng(42)
legit_sample = rng.choice(legit_scores, size=min(500, len(legit_scores)), replace=False).tolist()

metrics = {
    "training_info": {
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "n_fraud_train": int((y_train == 1).sum()),
        "n_fraud_test": int((y_test == 1).sum()),
        "scale_pos_weight": round(float(fraud_ratio), 1),
        "n_estimators": 100,
        "max_depth": 6,
        "learning_rate": 0.1,
        "threshold": 0.85,
        "n_features": int(X.shape[1]),
    },
    "eval_metrics": {
        "roc_auc": round(float(auc), 4),
        "avg_precision": round(float(ap), 4),
        "precision": round(float(tp / (tp + fp)) if (tp + fp) else 0, 4),
        "recall": round(float(tp / (tp + fn)) if (tp + fn) else 0, 4),
        "f1": round(float(2 * tp / (2 * tp + fp + fn)) if (2 * tp + fp + fn) else 0, 4),
    },
    "confusion_matrix": {
        "tp": int(tp), "fp": int(fp),
        "tn": int(tn), "fn": int(fn),
    },
    "roc_curve": {
        "fpr": downsample(fpr),
        "tpr": downsample(tpr),
    },
    "pr_curve": {
        "precision": downsample(prec),
        "recall": downsample(rec),
    },
    "learning_curve": {
        "rounds": list(range(1, 101)),
        "train_aucpr": [round(v, 4) for v in train_aucpr],
        "test_aucpr":  [round(v, 4) for v in test_aucpr],
    },
    "feature_importance": [
        {"feature": f, "importance": round(float(v), 6)}
        for f, v in importance[:20]
    ],
    "score_distribution": {
        "fraud": [round(float(s), 4) for s in fraud_scores],
        "legit_sample": [round(float(s), 4) for s in legit_sample],
    },
}

print("[6/6] Saving model + metrics...")
with open(MODEL_PATH, "wb") as f:
    pickle.dump({"model": model, "scaler": scaler}, f)
with open(METRICS_PATH, "w") as f:
    json.dump(metrics, f)

print(f"\nDone.")
print(f"  model.pkl        → {MODEL_PATH}")
print(f"  model_metrics.json → {METRICS_PATH}")
print(f"  ROC-AUC: {auc:.4f} | Precision: {tp/(tp+fp):.2%} | Recall: {tp/(tp+fn):.2%}")
