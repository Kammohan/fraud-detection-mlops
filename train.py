import pickle
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler

CSV_PATH = "data/creditcard.csv"
MODEL_PATH = "model.pkl"

print("[1/5] Loading data...")
df = pd.read_csv(CSV_PATH)
print(f"      {len(df):,} rows | fraud rate: {df['Class'].mean()*100:.3f}%")

print("[2/5] Preparing features...")
X = df.drop(columns=["Class"])
y = df["Class"]

# Scale Amount and Time — V1-V28 are already PCA-transformed
scaler = StandardScaler()
X = X.copy()
X[["Amount", "Time"]] = scaler.fit_transform(X[["Amount", "Time"]])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# scale_pos_weight balances the 99.8%/0.2% class split
fraud_ratio = (y_train == 0).sum() / (y_train == 1).sum()
print(f"      scale_pos_weight = {fraud_ratio:.1f}")

print("[3/5] Training XGBoost...")
model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    scale_pos_weight=fraud_ratio,
    use_label_encoder=False,
    eval_metric="aucpr",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

print("[4/5] Evaluating...")
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]
print(f"      ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")
print(classification_report(y_test, y_pred, target_names=["legit", "fraud"]))

print("[5/5] Saving model + scaler...")
with open(MODEL_PATH, "wb") as f:
    pickle.dump({"model": model, "scaler": scaler}, f)

print(f"Done. Model saved to {MODEL_PATH}")
