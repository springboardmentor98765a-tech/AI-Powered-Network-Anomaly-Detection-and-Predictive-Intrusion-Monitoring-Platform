from datetime import datetime, timedelta, timezone
from math import log1p
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.network_models import NetworkPacket


MODEL_DIR = Path(__file__).resolve().parents[2] / "model_artifacts"
MODEL_PATH = MODEL_DIR / "module3_unsupervised_models.joblib"
LOOKBACK_DAYS = 30
MINIMUM_TRAINING_FLOWS = 30

PROTOCOL_CODES = {
    "UNKNOWN": 0,
    "TCP": 1,
    "UDP": 2,
    "HTTP": 3,
    "HTTPS": 4,
    "TLS": 5,
    "DNS": 6,
    "ICMP": 7,
    "ICMPV6": 8,
    "ARP": 9,
}

FEATURE_NAMES = [
    "log_packet_count",
    "log_total_bytes",
    "log_average_packet_size",
    "log_flow_duration_seconds",
    "log_packets_per_second",
    "log_source_port",
    "log_destination_port",
    "protocol_code",
]


def _feature_vector(flow: dict) -> list[float]:
    packet_count = max(int(flow.get("packet_count") or 0), 0)
    total_bytes = max(int(flow.get("total_bytes") or 0), 0)
    average_size = max(float(flow.get("average_packet_size") or 0), 0.0)
    first_seen = flow.get("first_seen")
    last_seen = flow.get("last_seen")

    if first_seen and last_seen:
        duration = max((last_seen - first_seen).total_seconds(), 1.0)
    else:
        duration = 1.0

    packet_rate = packet_count / duration
    protocol = str(flow.get("protocol") or "UNKNOWN").upper()

    return [
        log1p(packet_count),
        log1p(total_bytes),
        log1p(average_size),
        log1p(duration),
        log1p(packet_rate),
        log1p(max(int(flow.get("source_port") or 0), 0)),
        log1p(max(int(flow.get("destination_port") or 0), 0)),
        float(PROTOCOL_CODES.get(protocol, 0)),
    ]


def _training_flows(db: Session):
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    rows = db.execute(
        select(
            NetworkPacket.source_ip,
            NetworkPacket.destination_ip,
            NetworkPacket.protocol,
            NetworkPacket.source_port,
            NetworkPacket.destination_port,
            func.count(NetworkPacket.id).label("packet_count"),
            func.coalesce(func.sum(NetworkPacket.packet_length), 0).label("total_bytes"),
            func.avg(NetworkPacket.packet_length).label("average_packet_size"),
            func.min(NetworkPacket.captured_at).label("first_seen"),
            func.max(NetworkPacket.captured_at).label("last_seen"),
        )
        .where(
            NetworkPacket.captured_at >= cutoff,
            NetworkPacket.source_ip.is_not(None),
            NetworkPacket.destination_ip.is_not(None),
        )
        .group_by(
            NetworkPacket.source_ip,
            NetworkPacket.destination_ip,
            NetworkPacket.protocol,
            NetworkPacket.source_port,
            NetworkPacket.destination_port,
        )
        .having(func.count(NetworkPacket.id) >= 1)
        .order_by(func.count(NetworkPacket.id).desc())
        .limit(20000)
    ).all()

    flows = []
    for row in rows:
        flows.append({
            "source_ip": row.source_ip,
            "destination_ip": row.destination_ip,
            "protocol": row.protocol or "UNKNOWN",
            "source_port": row.source_port,
            "destination_port": row.destination_port,
            "packet_count": int(row.packet_count),
            "total_bytes": int(row.total_bytes or 0),
            "average_packet_size": float(row.average_packet_size or 0),
            "first_seen": row.first_seen,
            "last_seen": row.last_seen,
        })
    return flows


def train_unsupervised_models(db: Session, contamination: float = 0.05):
    """Train Isolation Forest and LOF on aggregate flow metadata."""
    if not 0.01 <= contamination <= 0.15:
        raise ValueError("contamination must be between 0.01 and 0.15")

    try:
        import joblib
        import numpy as np
        from sklearn.ensemble import IsolationForest
        from sklearn.neighbors import LocalOutlierFactor
        from sklearn.preprocessing import StandardScaler
    except ImportError as exc:
        raise RuntimeError(
            "Machine-learning dependencies are missing. Run pip install -r requirements.txt."
        ) from exc

    flows = _training_flows(db)
    if len(flows) < MINIMUM_TRAINING_FLOWS:
        raise ValueError(
            f"At least {MINIMUM_TRAINING_FLOWS} distinct flow records are required; "
            f"only {len(flows)} are currently available. Capture more traffic or import a dataset."
        )

    matrix = np.asarray([_feature_vector(flow) for flow in flows], dtype=float)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix)

    isolation_forest = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    isolation_forest.fit(scaled)

    neighbors = min(20, len(flows) - 1)
    local_outlier_factor = LocalOutlierFactor(
        n_neighbors=neighbors,
        contamination=contamination,
        novelty=True,
    )
    local_outlier_factor.fit(scaled)

    trained_at = datetime.now(timezone.utc)
    metadata = {
        "status": "TRAINED",
        "trained_at": trained_at.isoformat(),
        "training_flows": len(flows),
        "lookback_days": LOOKBACK_DAYS,
        "contamination": contamination,
        "algorithms": ["Isolation Forest", "Local Outlier Factor (novelty mode)"],
        "feature_names": FEATURE_NAMES,
        "evaluation_note": (
            "These are unsupervised models trained on local flow metadata. "
            "Accuracy, precision, recall and F1 require ground-truth labels and are not inferred from training output."
        ),
    }

    artifact = {
        "scaler": scaler,
        "isolation_forest": isolation_forest,
        "local_outlier_factor": local_outlier_factor,
        "metadata": metadata,
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)

    return metadata


def load_model_artifact():
    if not MODEL_PATH.is_file():
        return None

    try:
        import joblib
        return joblib.load(MODEL_PATH)
    except Exception:
        return None


def get_model_status():
    artifact = load_model_artifact()
    if artifact is None:
        return {
            "status": "NOT_TRAINED",
            "trained_at": None,
            "training_flows": 0,
            "algorithms": ["Isolation Forest", "Local Outlier Factor"],
            "message": "Train the models after sufficient packet-flow history has been collected.",
        }

    metadata = dict(artifact.get("metadata") or {})
    metadata["artifact_available"] = True
    return metadata


def classify_with_trained_models(flows: list[dict]):
    """Return model-flagged flow rows and model status for an analysis snapshot."""
    artifact = load_model_artifact()
    if artifact is None or not flows:
        return [], get_model_status()

    try:
        import numpy as np
        matrix = np.asarray([_feature_vector(flow) for flow in flows], dtype=float)
        scaled = artifact["scaler"].transform(matrix)
        isolation_predictions = artifact["isolation_forest"].predict(scaled)
        lof_predictions = artifact["local_outlier_factor"].predict(scaled)
        isolation_scores = artifact["isolation_forest"].decision_function(scaled)
        lof_scores = artifact["local_outlier_factor"].decision_function(scaled)
    except Exception:
        return [], {
            "status": "ERROR",
            "message": "The saved model could not score the current feature set. Retrain the models.",
        }

    findings = []
    for index, flow in enumerate(flows):
        isolation_flag = int(isolation_predictions[index]) == -1
        lof_flag = int(lof_predictions[index]) == -1
        votes = int(isolation_flag) + int(lof_flag)
        if votes == 0:
            continue

        risk_score = 62 if votes == 1 else 78
        detected_at = flow.get("last_seen")
        if detected_at is not None and detected_at.tzinfo is None:
            detected_at = detected_at.replace(tzinfo=timezone.utc)
        elif detected_at is not None:
            detected_at = detected_at.astimezone(timezone.utc)

        findings.append({
            "finding_type": "UNSUPERVISED_ML_OUTLIER",
            "classification": "MODEL_FLAGGED_ANOMALOUS_FLOW",
            "title": "Flow differs from learned network baseline",
            "description": (
                f"The trained unsupervised model ensemble flagged this flow as atypical "
                f"({votes}/2 model votes). Validate the packet context before treating it as malicious."
            ),
            "source_ip": flow.get("source_ip"),
            "destination_ip": flow.get("destination_ip"),
            "risk_score": risk_score,
            "risk_level": "HIGH" if risk_score >= 65 else "MEDIUM",
            "assessment": "Model-flagged deviation - analyst validation required",
            "evidence": {
                "packet_count": flow.get("packet_count"),
                "total_bytes": flow.get("total_bytes"),
                "protocol": flow.get("protocol"),
                "source_port": flow.get("source_port"),
                "destination_port": flow.get("destination_port"),
                "isolation_forest_flagged": isolation_flag,
                "local_outlier_factor_flagged": lof_flag,
                "isolation_forest_decision_score": round(float(isolation_scores[index]), 6),
                "local_outlier_factor_decision_score": round(float(lof_scores[index]), 6),
                "model_votes": f"{votes}/2",
            },
            "detected_at": detected_at,
        })

    return findings, get_model_status()
