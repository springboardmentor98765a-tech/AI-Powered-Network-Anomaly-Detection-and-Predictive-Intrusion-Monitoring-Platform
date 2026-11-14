# NetShield AI — Network monitoring: flows, live stats, CSV upload, single-flow analysis
# Developed by Krish | SKK Projects
import io
from collections import Counter
from datetime import timedelta

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import get_current_user, require_role
from app.database import get_db, utcnow
from app.ml.features import CICIDS_COLUMNS, FEATURES, PROTOCOL_NAME
from app.services.pipeline import analyze, process_flow

router = APIRouter(prefix="/api/traffic", tags=["Network Monitoring"])
MAX_UPLOAD_ROWS = 5000


@router.get("/flows", response_model=list[schemas.FlowOut])
def list_flows(limit: int = 100, attack: str | None = None, min_risk: int = 0,
               threats_only: bool = False, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.TrafficFlow)
    if attack:
        q = q.filter(models.TrafficFlow.predicted_attack == attack)
    if min_risk:
        q = q.filter(models.TrafficFlow.risk_score >= min_risk)
    if threats_only:
        q = q.filter((models.TrafficFlow.predicted_attack != "BENIGN") | (models.TrafficFlow.is_anomaly.is_(True)))
    return q.order_by(models.TrafficFlow.timestamp.desc()).limit(min(limit, 500)).all()


@router.get("/stats")
def traffic_stats(minutes: int = 60, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Protocol analysis and top talkers for the last N minutes."""
    since = utcnow() - timedelta(minutes=minutes)
    rows = db.query(models.TrafficFlow.protocol, models.TrafficFlow.src_ip, models.TrafficFlow.dst_port,
                    models.TrafficFlow.fwd_bytes, models.TrafficFlow.bwd_bytes,
                    models.TrafficFlow.fwd_packets, models.TrafficFlow.bwd_packets
                    ).filter(models.TrafficFlow.timestamp >= since).all()
    protocols, sources, ports = Counter(), Counter(), Counter()
    total_bytes = total_packets = 0
    for proto, src, port, fb, bb, fp, bp in rows:
        protocols[proto] += 1
        sources[src] += 1
        ports[port] += 1
        total_bytes += (fb or 0) + (bb or 0)
        total_packets += (fp or 0) + (bp or 0)
    return {
        "minutes": minutes, "flows": len(rows), "total_bytes": round(total_bytes),
        "total_packets": int(total_packets),
        "protocols": dict(protocols),
        "top_sources": [{"ip": ip, "flows": n} for ip, n in sources.most_common(8)],
        "top_ports": [{"port": p, "flows": n} for p, n in ports.most_common(8)],
    }


@router.post("/analyze")
def analyze_flow(body: schemas.FlowIn, _=Depends(get_current_user)):
    """Test the AI on one flow without saving it (great for Postman)."""
    return analyze(body.to_flow())


@router.post("/upload")
async def upload_flows(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db),
                       user: models.User = Depends(require_role("analyst"))):
    """Upload a CSV of flows (our format, or CICIDS2017 / CICFlowMeter format) and analyse every row."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file")
    try:
        df = pd.read_csv(io.BytesIO(await file.read()), nrows=MAX_UPLOAD_ROWS, low_memory=False)
    except Exception as exc:
        raise HTTPException(400, f"Could not read CSV: {exc}")
    df.columns = df.columns.str.strip()

    if "Flow Duration" in df.columns:  # CICIDS / CICFlowMeter export
        rename = {k: v for k, v in CICIDS_COLUMNS.items() if k in df.columns}
        rename.update({"Source IP": "src_ip", "Destination IP": "dst_ip", "Source Port": "src_port",
                       "Protocol": "protocol_num"})
        df = df.rename(columns=rename)
        df["duration"] = df["duration"] / 1_000_000
    missing = [f for f in FEATURES if f not in df.columns and f != "protocol_num"]
    if missing:
        raise HTTPException(400, f"CSV is missing columns: {', '.join(missing)}")
    if "protocol_num" not in df.columns:
        df["protocol_num"] = 6

    df = df.replace([float("inf"), float("-inf")], 0).fillna(0)
    counts = Counter()
    for record in df.to_dict(orient="records"):
        record["protocol"] = PROTOCOL_NAME.get(int(record.get("protocol_num", 6)), "OTHER")
        for col in ("src_ip", "dst_ip"):
            record[col] = str(record.get(col, "0.0.0.0"))
        row = process_flow(db, record, source="upload", commit=False)
        counts[row.predicted_attack] += 1
    db.commit()
    log_action(db, user, "traffic_uploaded", f"{file.filename}: {len(df)} rows", request)
    return {"rows_processed": int(len(df)), "predictions": dict(counts)}
