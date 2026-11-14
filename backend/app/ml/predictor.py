# NetShield AI — Live prediction engine
# Developed by Krish | SKK Projects
"""Loads the trained models once and answers: 'Is this flow normal or an attack?'"""
import threading

import numpy as np

from app.ml import train as trainer
from app.ml.features import flow_to_frame, transform


class Predictor:
    def __init__(self):
        self._bundle = None
        self._lock = threading.Lock()

    def load(self, auto_train: bool = True):
        with self._lock:
            if not trainer.BUNDLE_PATH.exists():
                if not auto_train:
                    raise FileNotFoundError("No trained model. Run: python -m app.ml.train")
                print("[predictor] no model found, training on synthetic data first...")
                trainer.train()
            self._bundle = trainer.joblib.load(trainer.BUNDLE_PATH)
            print(f"[predictor] loaded {self._bundle['classifier_name']} model")

    def reload(self):
        self._bundle = None
        self.load()

    @property
    def ready(self) -> bool:
        return self._bundle is not None

    def predict(self, flow: dict) -> dict:
        if self._bundle is None:
            self.load()
        b = self._bundle
        x = b["scaler"].transform(transform(flow_to_frame(flow)))

        # 1) Anomaly score: how 'strange' is this flow compared with normal traffic?
        raw = float(-b["iforest"].score_samples(x)[0])
        threshold = b["iforest_threshold"]
        anomaly_score = float(1 / (1 + np.exp(-25 * (raw - threshold))))  # 0..1, 0.5 = on the line

        # 2) Attack classification: which attack does it look like, and how sure are we?
        probs = b["classifier"].predict_proba(x)[0]
        classes = b["encoder"].classes_
        top = int(np.argmax(probs))
        predicted = str(classes[top])
        benign_idx = list(classes).index("BENIGN") if "BENIGN" in classes else None
        attack_probability = float(1 - probs[benign_idx]) if benign_idx is not None else float(probs[top])

        return {
            "is_anomaly": raw > threshold,
            "anomaly_score": round(anomaly_score, 4),
            "predicted_attack": predicted,
            "confidence": round(float(probs[top]), 4),
            "attack_probability": round(attack_probability, 4),
            "class_probabilities": {str(c): round(float(p), 4) for c, p in zip(classes, probs)},
        }


predictor = Predictor()
