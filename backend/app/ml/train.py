# NetShield AI — Model training and evaluation
# Developed by Krish | SKK Projects
"""
Run from the backend folder:
    python -m app.ml.train                                  # synthetic data (works instantly)
    python -m app.ml.train --cicids data/cicids.csv         # real CICIDS2017 file
    python -m app.ml.train --cicids data/a.csv --unsw data/UNSW_NB15_training-set.csv

It trains TWO kinds of AI:
 1. Isolation Forest  -> learns what NORMAL traffic looks like, flags anything unusual (anomaly detection)
 2. Classifier        -> learns each ATTACK type by example (intrusion prediction / attack classification)
    We train Random Forest AND XGBoost, compare them, and keep the winner.
"""
import argparse
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score, precision_score, recall_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.config import settings
from app.ml.features import FEATURES, clean_dataframe, load_cicids, load_unsw, transform
from app.ml.synthetic import generate_dataset


try:
    from xgboost import XGBClassifier
    HAS_XGB = True

except Exception as exc:
    print(f"[train] XGBoost unavailable: {exc}")
    print("[train] Falling back to Random Forest.")

    XGBClassifier = None
    HAS_XGB = False


BUNDLE_PATH = settings.MODEL_DIR / "netshield_models.joblib"
METRICS_PATH = settings.MODEL_DIR / "metrics.json"
REPORT_PATH = settings.MODEL_DIR / "detection_report.md"


def load_data(cicids: str | None, unsw: str | None, rows: int) -> tuple[pd.DataFrame, str]:
    frames, sources = [], []
    if cicids:
        frames.append(load_cicids(cicids, rows)); sources.append("CICIDS2017")
    if unsw:
        frames.append(load_unsw(unsw, rows)); sources.append("UNSW-NB15")
    if not frames:
        frames.append(generate_dataset(rows)); sources.append("Synthetic (CICIDS-style)")
    df = clean_dataframe(pd.concat(frames, ignore_index=True))
    return df, " + ".join(sources)


def train(cicids: str | None = None, unsw: str | None = None, rows: int = 30_000) -> dict:
    df, source = load_data(cicids, unsw, rows)
    print(f"[train] {len(df):,} clean rows from {source}")
    print(df["label"].value_counts().to_string())

    # ---------- 1. Preprocessing: log-squash, then scale every feature to a similar range
    X_raw = transform(df)
    encoder = LabelEncoder().fit(df["label"])
    y = encoder.transform(df["label"])
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.25, random_state=42, stratify=y)
    scaler = StandardScaler().fit(X_train_raw)
    X_train, X_test = scaler.transform(X_train_raw), scaler.transform(X_test_raw)

    benign_id = int(encoder.transform(["BENIGN"])[0]) if "BENIGN" in encoder.classes_ else -1

    # ---------- 2. Anomaly detection (unsupervised): train ONLY on normal traffic
    iforest = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=-1)
    iforest.fit(X_train[y_train == benign_id])
    benign_scores = -iforest.score_samples(X_train[y_train == benign_id])
    threshold = float(np.percentile(benign_scores, 97.5))  # top 2.5% of 'normal' = suspicious
    test_scores = -iforest.score_samples(X_test)
    anomaly_pred = (test_scores > threshold).astype(int)
    truth_attack = (y_test != benign_id).astype(int)
    anomaly_metrics = _binary_metrics(truth_attack, anomaly_pred)
    print(f"[train] Isolation Forest -> {anomaly_metrics}")

    # ---------- 3. Attack classification (supervised): compare two models
    candidates = {"RandomForest": RandomForestClassifier(
        n_estimators=150, max_depth=18, n_jobs=-1, random_state=42, class_weight="balanced")}
    if HAS_XGB:
        candidates["XGBoost"] = XGBClassifier(
            n_estimators=250, max_depth=7, learning_rate=0.15, subsample=0.9,
            colsample_bytree=0.9, tree_method="hist", eval_metric="mlogloss", n_jobs=-1)

    results, best_name, best_f1 = {}, None, -1.0
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        f1 = f1_score(y_test, pred, average="macro")
        results[name] = {
            "accuracy": round(float(accuracy_score(y_test, pred)), 4),
            "precision": round(float(precision_score(y_test, pred, average="macro", zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, pred, average="macro", zero_division=0)), 4),
            "f1": round(float(f1), 4),
        }
        print(f"[train] {name} -> {results[name]}")
        if f1 > best_f1:
            best_name, best_f1 = name, f1

    best = candidates[best_name]
    pred = best.predict(X_test)
    labels = list(encoder.classes_)
    binary_pred = (pred != benign_id).astype(int)
    security = _binary_metrics(truth_attack, binary_pred)

    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_source": source,
        "rows_used": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "best_model": best_name,
        "models": results,
        "classifier": results[best_name],
        "anomaly_detector": {"model": "IsolationForest", **anomaly_metrics},
        "security": security,  # detection rate & false positive rate of the final system
        "labels": labels,
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "per_class": classification_report(y_test, pred, target_names=labels,
                                           output_dict=True, zero_division=0),
        "class_counts": df["label"].value_counts().to_dict(),
    }

    joblib.dump({
        "scaler": scaler, "iforest": iforest, "iforest_threshold": threshold,
        "classifier": best, "classifier_name": best_name, "encoder": encoder,
        "features": FEATURES, "data_source": source,
    }, BUNDLE_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, default=float))
    REPORT_PATH.write_text(build_report(metrics))
    print(f"[train] saved models to {BUNDLE_PATH}")
    return metrics


def _binary_metrics(truth: np.ndarray, pred: np.ndarray) -> dict:
    tn, fp, fn, tp = confusion_matrix(truth, pred, labels=[0, 1]).ravel()
    return {
        "accuracy": round(float((tp + tn) / max(tp + tn + fp + fn, 1)), 4),
        "precision": round(float(tp / max(tp + fp, 1)), 4),
        "recall": round(float(tp / max(tp + fn, 1)), 4),
        "f1": round(float(2 * tp / max(2 * tp + fp + fn, 1)), 4),
        "detection_rate": round(float(tp / max(tp + fn, 1)), 4),
        "false_positive_rate": round(float(fp / max(fp + tn, 1)), 4),
    }


def build_report(m: dict) -> str:
    lines = [
        "# NetShield AI — Anomaly Detection Report", "",
        f"- Trained at: {m['trained_at']}", f"- Data source: {m['data_source']}",
        f"- Rows used: {m['rows_used']:,} (train {m['train_rows']:,} / test {m['test_rows']:,})",
        f"- Selected classifier: **{m['best_model']}**", "",
        "## Model comparison", "", "| Model | Accuracy | Precision | Recall | F1 |", "|---|---|---|---|---|",
    ]
    for name, r in m["models"].items():
        lines.append(f"| {name} | {r['accuracy']} | {r['precision']} | {r['recall']} | {r['f1']} |")
    a, s = m["anomaly_detector"], m["security"]
    lines += [
        "", "## Isolation Forest (anomaly detector)", "",
        f"Detection rate {a['detection_rate']}, false positive rate {a['false_positive_rate']}, F1 {a['f1']}",
        "", "## Final system (attack vs normal)", "",
        f"Threat detection rate {s['detection_rate']}, false positive rate {s['false_positive_rate']}",
        "", "## Per-class results", "", "| Class | Precision | Recall | F1 | Support |", "|---|---|---|---|---|",
    ]
    for label in m["labels"]:
        r = m["per_class"][label]
        lines.append(f"| {label} | {r['precision']:.3f} | {r['recall']:.3f} | {r['f1-score']:.3f} | {int(r['support'])} |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train NetShield AI models")
    parser.add_argument("--cicids", help="Path to a CICIDS2017 CSV file")
    parser.add_argument("--unsw", help="Path to a UNSW-NB15 CSV file")
    parser.add_argument("--rows", type=int, default=30_000, help="Max rows to load per dataset")
    args = parser.parse_args()
    train(args.cicids, args.unsw, args.rows)
