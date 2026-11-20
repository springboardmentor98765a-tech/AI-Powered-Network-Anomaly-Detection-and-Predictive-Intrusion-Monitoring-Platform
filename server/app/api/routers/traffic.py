import csv
import io
import random
import re
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.api.audit import log_audit_event
from app.api.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models import NetworkFlow, User
from app.schemas import (
    DirectionStat,
    HostStat,
    NetworkFlowCreate,
    NetworkFlowResponse,
    ProtocolStat,
    TimeSeriesPoint,
    TrafficSummary,
)

router = APIRouter(prefix="/api/traffic", tags=["Network Monitoring"])

KNOWN_PROTOCOLS = {"TCP", "UDP", "HTTP", "HTTPS", "DNS", "ICMP", "ARP"}


def normalize_protocol(raw_proto: str | None) -> str:
    if not raw_proto:
        return "UNKNOWN"
    proto_map = {
        "6": "TCP",
        "17": "UDP",
        "1": "ICMP",
        "2054": "ARP",
        "TLS": "HTTPS",
        "TLSv1.2": "HTTPS",
        "TLSv1.3": "HTTPS",
        "SSL": "HTTPS",
    }
    cleaned = proto_map.get(raw_proto.strip(), raw_proto.strip().upper())
    return cleaned if cleaned in KNOWN_PROTOCOLS else "UNKNOWN"


def is_private_ip(ip: str) -> bool:
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    try:
        a, b = int(parts[0]), int(parts[1])
    except ValueError:
        return False
    return (
        a == 10
        or (a == 172 and 16 <= b <= 31)
        or (a == 192 and b == 168)
        or a == 127
    )


def detect_direction(src_ip: str, dst_ip: str) -> str:
    src_priv = is_private_ip(src_ip)
    dst_priv = is_private_ip(dst_ip)
    if src_priv and not dst_priv:
        return "OUTBOUND"
    if not src_priv and dst_priv:
        return "INBOUND"
    return "INTERNAL"


def extract_ports_from_info(info_text: str) -> tuple[int, int]:
    if not info_text:
        return 0, 0
    match = re.search(r"\b(\d{1,5})\s*(?:->|→)\s*(\d{1,5})\b", info_text)
    if match:
        src_p = int(match.group(1))
        dst_p = int(match.group(2))
        if 0 <= src_p <= 65535 and 0 <= dst_p <= 65535:
            return src_p, dst_p
    return 0, 0


def parse_int(val: str | None, default: int = 0) -> int:
    if not val:
        return default
    try:
        return int(float(val.strip()))
    except ValueError:
        return default


def parse_float(val: str | None, default: float = 0.0) -> float:
    if not val:
        return default
    try:
        return float(val.strip())
    except ValueError:
        return default


@router.post("/ingest", response_model=NetworkFlowResponse)
def ingest_flow(
    body: NetworkFlowCreate,
    current_user: User = Depends(require_roles(["Administrator", "Team Lead"])),
    db: Session = Depends(get_db),
):
    data = body.model_dump()
    data["protocol"] = normalize_protocol(data.get("protocol"))
    flow = NetworkFlow(**data)
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


@router.post("/upload-csv")
async def upload_traffic_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(["Administrator", "Team Lead"])),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    decoded = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(decoded))

    flows_to_insert: list[NetworkFlow] = []
    for idx, row in enumerate(reader):
        if idx >= 5000:
            break
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
        if not clean_row:
            continue

        src_ip = (
            clean_row.get("Source")
            or clean_row.get("Source IP")
            or clean_row.get("src_ip")
            or "0.0.0.0"
        )
        dst_ip = (
            clean_row.get("Destination")
            or clean_row.get("Destination IP")
            or clean_row.get("dst_ip")
            or "0.0.0.0"
        )

        info_text = clean_row.get("Info") or clean_row.get("info") or ""
        info_src_port, info_dst_port = extract_ports_from_info(info_text)

        src_port = parse_int(
            clean_row.get("Source Port") or clean_row.get("src_port"),
            info_src_port,
        )
        dst_port = parse_int(
            clean_row.get("Destination Port") or clean_row.get("dst_port"),
            info_dst_port,
        )

        raw_proto = clean_row.get("Protocol") or clean_row.get("protocol") or "UNKNOWN"
        protocol = normalize_protocol(raw_proto)

        pkt_len = parse_int(
            clean_row.get("Length")
            or clean_row.get("Total Length of Fwd Packets")
            or clean_row.get("packet_length"),
            0,
        )
        duration = parse_float(
            clean_row.get("Flow Duration") or clean_row.get("flow_duration"),
            0.0,
        )

        label = clean_row.get("Label") or clean_row.get("status") or "NORMAL"
        status = "NORMAL" if label.upper() in {"BENIGN", "NORMAL"} else "SUSPICIOUS"

        flows_to_insert.append(
            NetworkFlow(
                source_ip=src_ip[:45],
                destination_ip=dst_ip[:45],
                source_port=src_port,
                destination_port=dst_port,
                protocol=protocol,
                packet_length=pkt_len,
                flow_duration=duration,
                flag=clean_row.get("Flag") or clean_row.get("flag") or None,
                status=status,
            )
        )

    if not flows_to_insert:
        raise HTTPException(status_code=400, detail="No valid flow records found in CSV")

    db.bulk_save_objects(flows_to_insert)
    db.commit()

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="TRAFFIC_CSV_INGESTED",
        target_type="NETWORK_FLOW",
        status="SUCCESS",
        details={"filename": file.filename, "rows": len(flows_to_insert)},
    )
    return {"message": f"Successfully ingested {len(flows_to_insert)} network flows from {file.filename}."}


@router.post("/simulate")
def simulate_traffic_batch(
    count: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_roles(["Administrator", "Team Lead"])),
    db: Session = Depends(get_db),
):
    protocols = ["TCP", "UDP", "HTTPS", "DNS", "HTTP", "ICMP", "ARP", "UNKNOWN"]
    flags = ["SYN", "ACK", "PSH-ACK", "FIN", "RST"]
    internal_ips = [f"192.168.1.{i}" for i in range(10, 35)]
    external_ips = ["104.21.44.12", "172.217.16.14", "185.220.101.4", "8.8.8.8", "45.33.32.156"]

    batch: list[NetworkFlow] = []
    for _ in range(count):
        proto = random.choices(protocols, weights=[28, 18, 18, 10, 8, 6, 7, 5])[0]
        is_suspicious = random.random() < 0.12
        is_inbound = random.random() < 0.45
        src_ip = random.choice(external_ips) if is_inbound else random.choice(internal_ips)
        dst_ip = random.choice(internal_ips) if is_inbound else random.choice(external_ips)

        dst_port = (
            0
            if proto in {"ICMP", "ARP", "UNKNOWN"}
            else (
                443
                if proto == "HTTPS"
                else (
                    53
                    if proto == "DNS"
                    else (80 if proto == "HTTP" else random.choice([22, 8080, 3389, 445]))
                )
            )
        )

        batch.append(
            NetworkFlow(
                timestamp=datetime.utcnow() - timedelta(seconds=random.randint(0, 600)),
                source_ip=src_ip,
                destination_ip=dst_ip,
                source_port=random.randint(1024, 65535),
                destination_port=dst_port,
                protocol=proto,
                packet_length=random.randint(1200, 9000) if is_suspicious else random.randint(64, 1460),
                flow_duration=round(random.uniform(5.0, 1200.0), 2),
                flag="SYN" if is_suspicious else random.choice(flags),
                status="SUSPICIOUS" if is_suspicious else "NORMAL",
            )
        )

    db.bulk_save_objects(batch)
    db.commit()
    return {"message": f"Generated {count} simulated network flow records."}


@router.get("/summary", response_model=TrafficSummary)
def get_traffic_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    all_flows = db.query(NetworkFlow).all()
    total_flows = len(all_flows)
    total_bytes = sum(f.packet_length or 0 for f in all_flows)
    suspicious_count = sum(1 for f in all_flows if f.status != "NORMAL")

    proto_counts = defaultdict(int)
    proto_bytes = defaultdict(int)
    src_counts = defaultdict(int)
    src_bytes = defaultdict(int)
    dst_counts = defaultdict(int)
    dst_bytes = defaultdict(int)
    dir_counts = defaultdict(int)
    dir_bytes = defaultdict(int)
    time_pkts = defaultdict(int)
    time_bytes = defaultdict(int)

    for f in all_flows:
        proto = normalize_protocol(f.protocol)
        plen = f.packet_length or 0

        proto_counts[proto] += 1
        proto_bytes[proto] += plen

        src_counts[f.source_ip] += 1
        src_bytes[f.source_ip] += plen

        dst_counts[f.destination_ip] += 1
        dst_bytes[f.destination_ip] += plen

        direction = detect_direction(f.source_ip, f.destination_ip)
        dir_counts[direction] += 1
        dir_bytes[direction] += plen

        ts = f.timestamp or datetime.utcnow()
        bucket = ts.strftime("%H:%M")
        time_pkts[bucket] += 1
        time_bytes[bucket] += plen

    protocols = [
        ProtocolStat(protocol=p, count=proto_counts[p], total_bytes=proto_bytes[p])
        for p in sorted(proto_counts.keys(), key=lambda k: proto_counts[k], reverse=True)
    ]

    top_sources = [
        HostStat(ip=ip, packet_count=src_counts[ip], total_bytes=src_bytes[ip])
        for ip in sorted(src_counts.keys(), key=lambda k: src_bytes[k], reverse=True)[:5]
    ]

    top_destinations = [
        HostStat(ip=ip, packet_count=dst_counts[ip], total_bytes=dst_bytes[ip])
        for ip in sorted(dst_counts.keys(), key=lambda k: dst_bytes[k], reverse=True)[:5]
    ]

    directions = [
        DirectionStat(direction=d, count=dir_counts[d], total_bytes=dir_bytes[d])
        for d in ["OUTBOUND", "INBOUND", "INTERNAL"]
        if dir_counts[d] > 0
    ]

    activity_over_time = [
        TimeSeriesPoint(time_bucket=b, packet_count=time_pkts[b], total_bytes=time_bytes[b])
        for b in sorted(time_pkts.keys())[-12:]
    ]

    return TrafficSummary(
        total_flows=total_flows,
        total_bytes=total_bytes,
        suspicious_count=suspicious_count,
        protocols=protocols,
        top_sources=top_sources,
        top_destinations=top_destinations,
        directions=directions,
        activity_over_time=activity_over_time,
    )


@router.get("/flows", response_model=list[NetworkFlowResponse])
def get_network_flows(
    protocol: str | None = None,
    status: str | None = None,
    search_ip: str | None = None,
    port: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(NetworkFlow)
    if protocol:
        query = query.filter(NetworkFlow.protocol == normalize_protocol(protocol))
    if status:
        query = query.filter(NetworkFlow.status == status.upper())
    if search_ip:
        query = query.filter(
            (NetworkFlow.source_ip.contains(search_ip)) | (NetworkFlow.destination_ip.contains(search_ip))
        )
    if port is not None:
        query = query.filter(
            (NetworkFlow.source_port == port) | (NetworkFlow.destination_port == port)
        )
    return query.order_by(NetworkFlow.timestamp.desc()).limit(limit).all()