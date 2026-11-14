# NetShield AI — AI model metrics, reports, retraining and intrusion forecasting
# Developed by Krish | SKK Projects
import json
import math
from collections import Counter
from datetime import timedelta

import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app import models
from app.audit import log_action
from app.auth import get_current_user, require_role
from app.database import get_db, utcnow
from app.ml import train as trainer
from app.ml.predictor import predictor

router = APIRouter(prefix="/api/detection", tags=["AI Detection"])
_training = {"running": False, "last_error": None}


@router.get("/metrics")
def model_metrics(_=Depends(get_current_user)):
    if not trainer.METRICS_PATH.exists():
        raise HTTPException(404, "Model not trained yet")
    data = json.loads(trainer.METRICS_PATH.read_text())
    data["training_in_progress"] = _training["running"]
    return data


@router.get("/report", response_class=PlainTextResponse)
def detection_report(_=Depends(get_current_user)):
    if not trainer.REPORT_PATH.exists():
        raise HTTPException(404, "No report yet")
    return trainer.REPORT_PATH.read_text()


def _retrain_job(rows: int):
    _training["running"], _training["last_error"] = True, None
    try:
        trainer.train(rows=rows)
        predictor.reload()
    except Exception as exc:
        _training["last_error"] = str(exc)
    finally:
        _training["running"] = False


@router.post("/retrain", status_code=202)
def retrain(request: Request, background: BackgroundTasks, rows: int = 30_000,
            db: Session = Depends(get_db), admin: models.User = Depends(require_role("admin"))):
    if _training["running"]:
        raise HTTPException(409, "Training is already running")
    background.add_task(_retrain_job, min(rows, 200_000))
    log_action(db, admin, "model_retrain", f"rows={rows}", request)
    return {"message": "Training started. Check /api/detection/metrics in a minute."}


@router.get("/forecast")
def intrusion_forecast(bucket_minutes: int = 10, history: int = 12, horizon: int = 6,
                       db: Session = Depends(get_db), _=Depends(get_current_user)):
    """
    Intrusion forecasting: count attacks in recent time 'buckets', fit a trend line,
    and project it forward. Also gives the chance of at least one attack next bucket.
    """
    now = utcnow()
    start = now - timedelta(minutes=bucket_minutes * history)
    rows = db.query(models.TrafficFlow.timestamp, models.TrafficFlow.predicted_attack).filter(
        models.TrafficFlow.timestamp >= start).all()

    attacks = [0] * history
    totals = [0] * history
    by_type = Counter()
    for ts, attack in rows:
        idx = min(int((ts - start).total_seconds() // (bucket_minutes * 60)), history - 1)
        totals[idx] += 1
        if attack != "BENIGN":
            attacks[idx] += 1
            by_type[attack] += 1

    x = np.arange(history)
    slope, intercept = np.polyfit(x, attacks, 1) if any(attacks) else (0.0, 0.0)
    recent_avg = float(np.mean(attacks[-3:]))
    forecast = []
    for step in range(1, horizon + 1):
        trend_value = slope * (history - 1 + step) + intercept
        expected = max(0.0, 0.5 * trend_value + 0.5 * recent_avg)  # blend trend + recent average
        forecast.append({
            "time": (now + timedelta(minutes=bucket_minutes * step)).isoformat(),
            "expected_attacks": round(expected, 1),
        })

    next_expected = forecast[0]["expected_attacks"] if forecast else 0
    total_attacks = sum(by_type.values()) or 1
    trend = "rising" if slope > 0.3 else "falling" if slope < -0.3 else "stable"
    return {
        "bucket_minutes": bucket_minutes,
        "history": [{"time": (start + timedelta(minutes=bucket_minutes * i)).isoformat(),
                     "attacks": attacks[i], "total": totals[i]} for i in range(history)],
        "forecast": forecast,
        "trend": trend,
        # Poisson model: chance of 1+ attacks when we expect 'next_expected' attacks
        "next_bucket_attack_probability": round(1 - math.exp(-next_expected), 3),
        "attack_type_probability": {k: round(v / total_attacks, 3) for k, v in by_type.most_common()},
    }
