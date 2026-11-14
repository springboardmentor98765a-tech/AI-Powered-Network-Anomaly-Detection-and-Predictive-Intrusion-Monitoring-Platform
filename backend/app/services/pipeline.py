# NetShield AI — The detection pipeline (heart of the system)
# Developed by Krish | SKK Projects
"""
Every flow goes through the same steps, like a student's answer sheet going
from collection -> checking -> marking -> report card:
  1. Feature extraction   (already numbers in the flow dict)
  2. Anomaly detection    (Isolation Forest)
  3. Intrusion prediction (XGBoost / Random Forest)
  4. Threat intelligence  (is the IP known-bad?)
  5. Risk scoring         (0-100)
  6. Alert + notification (if risky enough)
"""
from sqlalchemy.orm import Session

from app import models
from app.ml.features import PROTOCOL_NAME
from app.ml.predictor import predictor
from app.ml.risk import compute_risk
from app.services import threat_intel
from app.services.notifier import notify

FLOW_FIELDS = [
    "duration", "fwd_packets", "bwd_packets", "fwd_bytes", "bwd_bytes", "flow_bytes_per_s",
    "flow_packets_per_s", "syn_count", "ack_count", "rst_count", "fin_count", "avg_packet_size",
]
ALERT_TITLES = {
    "DDoS": "Possible DDoS flood", "PortScan": "Port scanning activity",
    "BruteForce": "Brute-force login attempts", "WebAttack": "Web application attack",
    "Botnet": "Botnet command-and-control traffic", "BENIGN": "Unusual network behaviour",
}


def analyze(flow: dict) -> dict:
    """Runs the AI steps WITHOUT saving anything (used by the /analyze test endpoint)."""
    prediction = predictor.predict(flow)
    intel = threat_intel.lookup(flow.get("src_ip", ""))
    risk = compute_risk(prediction, flow.get("dst_port", 0), threat_intel_hit=intel is not None)
    return {**prediction, **risk, "threat_intel": intel}


def process_flow(db: Session, flow: dict, source: str = "sensor", commit: bool = True) -> models.TrafficFlow:
    result = analyze(flow)
    protocol = flow.get("protocol") or PROTOCOL_NAME.get(int(flow.get("protocol_num", 6)), "OTHER")

    row = models.TrafficFlow(
        src_ip=flow.get("src_ip", "0.0.0.0"), dst_ip=flow.get("dst_ip", "0.0.0.0"),
        src_port=int(flow.get("src_port", 0)), dst_port=int(flow.get("dst_port", 0)),
        protocol=protocol, source=source,
        **{f: float(flow.get(f, 0) or 0) for f in FLOW_FIELDS},
        is_anomaly=bool(result["is_anomaly"]), anomaly_score=result["anomaly_score"],
        predicted_attack=result["predicted_attack"], attack_probability=result["attack_probability"],
        risk_score=result["risk_score"], risk_level=result["risk_level"],
        threat_intel_hit=result["threat_intel"] is not None,
    )
    if flow.get("timestamp") is not None:
        row.timestamp = flow["timestamp"]
    db.add(row)
    db.flush()  # gives the row an id

    # Create an alert when the flow is risky: an attack OR a strong anomaly, Medium risk or above
    suspicious = row.predicted_attack != "BENIGN" or row.is_anomaly
    if suspicious and row.risk_level in ("Medium", "High", "Critical"):
        alert = models.Alert(
            flow_id=row.id, title=ALERT_TITLES.get(row.predicted_attack, "Suspicious traffic"),
            attack_type=row.predicted_attack if row.predicted_attack != "BENIGN" else "Anomaly",
            severity=row.risk_level, risk_score=row.risk_score,
            src_ip=row.src_ip, dst_ip=row.dst_ip, dst_port=row.dst_port,
        )
        if flow.get("timestamp") is not None:
            alert.created_at = flow["timestamp"]
        db.add(alert)
        db.flush()
        if source == "sensor":
            notify(alert)
    if commit:
        db.commit()
    return row
