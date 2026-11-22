
# NetShield AI — Network Monitoring Module
# Protocol analysis, traffic analytics, filters and CSV ingestion.

import ipaddress
import io
import logging
import math
import os
import re
import csv

from collections import Counter, defaultdict
from datetime import datetime, timedelta

import pandas as pd

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
)

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import get_current_user, require_role
from app.database import get_db, utcnow
from app.ml.features import CICIDS_COLUMNS, FEATURES, PROTOCOL_NAME
from app.services.pipeline import analyze, process_flow
from app.services.live_sensor import sensor_status, start_live_sensor, stop_live_sensor


router = APIRouter(prefix="/api/traffic", tags=["Network Monitoring"])

MAX_UPLOAD_ROWS = 5000
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CSV_MEDIA_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
}

INTEGER_FLOW_FIELDS = {
    "fwd_packets",
    "bwd_packets",
    "syn_count",
    "ack_count",
    "rst_count",
    "fin_count",
    "dst_port",
    "protocol_num",
}

WIRESHARK_PACKET_COLUMNS = {
    "packet_number", "capture_time", "src_ip", "dst_ip", "protocol", "packet_length"
}
WIRESHARK_PORTS = re.compile(r"(?P<src>\d{1,5})\s*(?:→|->)\s*(?P<dst>\d{1,5})")
WIRESHARK_FLOW_GAP_SECONDS = 60

WIRESHARK_HEADER_ALIASES = {
    "no": "packet_number",
    "no.": "packet_number",
    "number": "packet_number",
    "packet number": "packet_number",
    "time": "capture_time",
    "time (s)": "capture_time",
    "timestamp": "capture_time",
    "source": "src_ip",
    "source address": "src_ip",
    "destination": "dst_ip",
    "destination address": "dst_ip",
    "protocol": "protocol",
    "length": "packet_length",
    "packet length": "packet_length",
    "info": "packet_info",
}

logger = logging.getLogger(__name__)

MAX_STATS_MINUTES = 7 * 24 * 60
MAX_TIMELINE_POINTS = 2016

DEFAULT_INTERNAL_CIDRS = (
    "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7"
)

KNOWN_PROTOCOLS = {
    "TCP", "UDP", "ICMP", "ICMPV6",
    "IGMP", "GRE", "ESP", "AH",
    "SCTP", "OSPF", "IPIP", "IPV6",
    "L2TP", "PIM", "VRRP",
}

PROTOCOL_ALIASES = {
    "ICMP6": "ICMPV6",
    "IPV6-ICMP": "ICMPV6",
    "IPV6_ICMP": "ICMPV6",
}


# =========================================================
# PROTOCOL CLASSIFICATION
# =========================================================

def normalize_protocol(value):
    """
    Returns:
        display_name, raw_name, is_known
    """

    raw = "" if value is None else str(value).strip().upper()

    if not raw:
        return "OTHER", "UNKNOWN", False

    if raw.isdigit():
        number = int(raw)
        mapped = PROTOCOL_NAME.get(number)

        if mapped:
            return mapped, raw, True

        return "OTHER", f"IP_PROTOCOL_{number}", False

    label = PROTOCOL_ALIASES.get(raw, raw)

    if label in KNOWN_PROTOCOLS:
        return label, raw, True

    return "OTHER", raw, False


def _clean_upload_record(record):
    """Return a safe, model-ready CSV row or ``None`` for malformed input."""
    cleaned = dict(record)

    for feature in FEATURES:
        value = record.get(feature)
        if value is None or pd.isna(value):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(number) or number < 0:
            return None
        if feature in INTEGER_FLOW_FIELDS:
            if not number.is_integer():
                return None
            number = int(number)
        cleaned[feature] = number

    if cleaned["dst_port"] > 65535 or cleaned["protocol_num"] > 255:
        return None

    for column in ("src_port", "dst_port"):
        value = cleaned.get(column, 0)
        try:
            number = int(float(value))
        except (TypeError, ValueError):
            return None
        if not 0 <= number <= 65535:
            return None
        cleaned[column] = number

    for column in ("src_ip", "dst_ip"):
        value = cleaned.get(column, "0.0.0.0")
        if value is None or pd.isna(value) or not str(value).strip():
            return None
        cleaned[column] = str(value).strip()

    return cleaned


def _read_upload_csv(content, filename):
    """Decode a bounded CSV upload using common Wireshark export encodings."""
    failures = []
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = content.decode(encoding, errors="strict")
            sample = text[:8192]
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
                separator = dialect.delimiter
            except csv.Error:
                separator = ","
            return pd.read_csv(
                io.StringIO(text),
                sep=separator,
                quotechar='"',
                nrows=MAX_UPLOAD_ROWS + 1,
                low_memory=False,
                on_bad_lines="error",
            )
        except (UnicodeDecodeError, UnicodeError, pd.errors.ParserError, pd.errors.EmptyDataError, csv.Error, ValueError) as exc:
            failures.append(f"{encoding}: {exc.__class__.__name__}")

    logger.warning(
        "CSV parsing failed for upload %r after encoding attempts: %s",
        file_name_for_log(filename),
        "; ".join(failures),
    )
    raise HTTPException(
        400,
        "Could not read CSV. Export the packet list as CSV with column headings, "
        "or use a UTF-8/Windows-1252 compatible CSV.",
    )


def file_name_for_log(filename):
    """Keep log messages single-line and bounded without exposing file contents."""
    return re.sub(r"[\r\n]", " ", str(filename or "upload"))[:180]


def _normalise_wireshark_headers(df):
    """Map whitespace, BOM, and common Wireshark header variations to canonical names."""
    rename = {}
    for column in df.columns:
        key = re.sub(r"\s+", " ", str(column).replace("\ufeff", "").strip().lower())
        canonical = WIRESHARK_HEADER_ALIASES.get(key)
        if canonical:
            rename[column] = canonical
    normalised = df.rename(columns=rename)
    if normalised.columns.duplicated().any():
        raise HTTPException(400, "CSV contains duplicate column names after header normalization.")
    return normalised


def _is_wireshark_packet_export(df):
    """Detect Wireshark's packet-list CSV export without guessing arbitrary CSVs."""
    return WIRESHARK_PACKET_COLUMNS.issubset(set(df.columns))


def _parse_wireshark_time(value):
    """Return an ordering timestamp and an optional absolute packet timestamp."""
    text = str(value).strip()
    if not text:
        raise ValueError("missing capture time")
    try:
        # Wireshark's relative time is usually a decimal number.
        number = float(text.replace(",", ".") if "." not in text else text.replace(",", ""))
        return number, None
    except ValueError:
        parsed = pd.to_datetime(text, errors="raise", utc=True)
        return parsed.timestamp(), parsed.to_pydatetime().replace(tzinfo=None)


def _wireshark_packet_rows(df):
    """Aggregate packet metadata into bidirectional flows without inventing fields."""
    flows = {}
    completed = []
    rejected = 0
    rejection_reasons = Counter()
    protocol_numbers = {name: number for number, name in PROTOCOL_NAME.items()}

    for packet in df.to_dict(orient="records"):
        src = str(packet.get("src_ip", "")).strip()
        dst = str(packet.get("dst_ip", "")).strip()
        protocol, _, known = normalize_protocol(packet.get("protocol"))

        try:
            packet_number = int(float(packet.get("packet_number")))
            timestamp, absolute_time = _parse_wireshark_time(packet.get("capture_time"))
            length = float(packet.get("packet_length"))
        except (TypeError, ValueError):
            rejected += 1
            rejection_reasons["invalid packet number, timestamp, or length"] += 1
            continue

        try:
            ipaddress.ip_address(src)
            ipaddress.ip_address(dst)
        except ValueError:
            rejected += 1
            rejection_reasons["invalid source or destination IP"] += 1
            continue

        if packet_number < 0 or not math.isfinite(timestamp) or not math.isfinite(length) or length < 0:
            rejected += 1
            rejection_reasons["invalid packet number, timestamp, or length"] += 1
            continue

        info = "" if pd.isna(packet.get("packet_info")) else str(packet.get("packet_info", ""))
        ports = WIRESHARK_PORTS.search(info)
        src_port = int(ports.group("src")) if ports else 0
        dst_port = int(ports.group("dst")) if ports else 0
        if src_port > 65535 or dst_port > 65535:
            rejected += 1
            rejection_reasons["invalid TCP or UDP port"] += 1
            continue

        endpoints = tuple(sorted(((src, src_port), (dst, dst_port))))
        key = (endpoints, protocol)
        flow = flows.get(key)
        if flow and timestamp - flow["last_time"] > WIRESHARK_FLOW_GAP_SECONDS:
            completed.append(flow)
            flow = None
        if flow is None:
            flow = {
            "src_ip": src,
            "dst_ip": dst,
            "src_port": src_port,
            "dst_port": dst_port,
            "protocol": protocol,
            "protocol_num": protocol_numbers.get(protocol, 0 if not known else 6),
            "first_time": timestamp,
            "last_time": timestamp,
            "fwd_packets": 0,
            "bwd_packets": 0,
            "fwd_bytes": 0.0,
            "bwd_bytes": 0.0,
            "syn_count": 0,
            "ack_count": 0,
            "rst_count": 0,
            "fin_count": 0,
            "timestamp": absolute_time,
            }
            flows[key] = flow
        flow["first_time"] = min(flow["first_time"], timestamp)
        flow["last_time"] = max(flow["last_time"], timestamp)
        if (src, src_port, dst, dst_port) == (flow["src_ip"], flow["src_port"], flow["dst_ip"], flow["dst_port"]):
            flow["fwd_packets"] += 1
            flow["fwd_bytes"] += length
        else:
            flow["bwd_packets"] += 1
            flow["bwd_bytes"] += length
        if absolute_time is not None:
            flow["timestamp"] = absolute_time
        upper_info = info.upper()
        flow["syn_count"] += int("SYN" in upper_info)
        flow["ack_count"] += int("ACK" in upper_info)
        flow["rst_count"] += int("RST" in upper_info)
        flow["fin_count"] += int("FIN" in upper_info)

    records = []
    for flow in [*completed, *flows.values()]:
        duration = flow.pop("last_time") - flow.pop("first_time")
        total_packets = flow["fwd_packets"] + flow["bwd_packets"]
        total_bytes = flow["fwd_bytes"] + flow["bwd_bytes"]
        flow.update({
            "duration": duration,
            "flow_bytes_per_s": total_bytes / duration if duration > 0 else 0,
            "flow_packets_per_s": total_packets / duration if duration > 0 else 0,
            "avg_packet_size": total_bytes / total_packets if total_packets else 0,
        })
        if flow.get("timestamp") is None:
            flow.pop("timestamp")
        records.append(flow)

    return records, rejected, dict(rejection_reasons)


# =========================================================
# INTERNAL NETWORK CLASSIFICATION
# =========================================================

def _internal_networks():

    configured = os.getenv(
        "NETSHIELD_INTERNAL_CIDRS",
        DEFAULT_INTERNAL_CIDRS
    )

    networks = []
    invalid = []

    for item in configured.split(","):

        value = item.strip()

        if not value:
            continue

        try:
            networks.append(
                ipaddress.ip_network(value, strict=False)
            )

        except ValueError:
            invalid.append(value)

    if invalid:
        print(
            "[traffic] Ignoring invalid internal CIDRs:",
            ", ".join(invalid)
        )

    return networks


def _is_internal(value, networks):

    try:
        address = ipaddress.ip_address(str(value))

    except (ValueError, TypeError):
        return None

    return any(
        address.version == network.version and address in network
        for network in networks
    )


# =========================================================
# SHARED FLOW FILTERS
# =========================================================

def _apply_flow_filters(
    query,
    *,
    src_ip=None,
    dst_ip=None,
    protocol=None,
    port=None,
    attack=None,
    min_risk=0,
    threats_only=False
):

    flow = models.TrafficFlow

    if src_ip:
        query = query.filter(
            flow.src_ip == src_ip.strip()
        )

    if dst_ip:
        query = query.filter(
            flow.dst_ip == dst_ip.strip()
        )

    if protocol:

        wanted = protocol.strip().upper()

        if wanted == "OTHER":

            query = query.filter(
                or_(
                    flow.protocol.is_(None),
                    func.upper(flow.protocol).notin_(KNOWN_PROTOCOLS)
                )
            )

        else:

            query = query.filter(
                func.upper(flow.protocol) == wanted
            )

    if port is not None:

        query = query.filter(
            or_(
                flow.src_port == port,
                flow.dst_port == port
            )
        )

    if attack:

        query = query.filter(
            flow.predicted_attack == attack
        )

    if min_risk:

        query = query.filter(
            flow.risk_score >= min_risk
        )

    if threats_only:

        query = query.filter(
            (flow.predicted_attack != "BENIGN")
            | (flow.is_anomaly.is_(True))
        )

    return query


# =========================================================
# TIMELINE HELPERS
# =========================================================

def _floor_time(value, bucket_minutes):

    minute = (
        value.minute // bucket_minutes
    ) * bucket_minutes

    return value.replace(
        minute=minute,
        second=0,
        microsecond=0
    )


def _timeline_rows(query, bucket_minutes):
    """
    Aggregate timeline by minute, then combine into requested buckets.
    Supports SQLite and PostgreSQL with a portable fallback.
    """

    flow = models.TrafficFlow
    dialect = query.session.get_bind().dialect.name

    if dialect == "sqlite":

        minute_expr = func.strftime(
            "%Y-%m-%d %H:%M:00",
            flow.timestamp
        )

    elif dialect == "postgresql":

        minute_expr = func.date_trunc(
            "minute",
            flow.timestamp
        )

    else:

        rows = query.with_entities(
            flow.timestamp,
            flow.predicted_attack,
            flow.is_anomaly,
            flow.fwd_packets,
            flow.bwd_packets,
            flow.fwd_bytes,
            flow.bwd_bytes,
        ).yield_per(1000)

        totals = defaultdict(
            lambda: {
                "flows": 0,
                "packets": 0,
                "bytes": 0,
                "attacks": 0,
                "anomalies": 0
            }
        )

        for row in rows:

            key = _floor_time(
                row.timestamp,
                bucket_minutes
            )

            item = totals[key]

            item["flows"] += 1

            item["packets"] += (
                int(row.fwd_packets or 0)
                + int(row.bwd_packets or 0)
            )

            item["bytes"] += round(
                (row.fwd_bytes or 0)
                + (row.bwd_bytes or 0)
            )

            item["attacks"] += int(
                (row.predicted_attack or "BENIGN") != "BENIGN"
            )

            item["anomalies"] += int(
                bool(row.is_anomaly)
            )

        return totals

    minute = minute_expr.label("minute")

    rows = query.with_entities(

        minute,

        func.count(flow.id).label("flows"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_packets, 0)
                + func.coalesce(flow.bwd_packets, 0)
            ),
            0
        ).label("packets"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_bytes, 0)
                + func.coalesce(flow.bwd_bytes, 0)
            ),
            0
        ).label("bytes"),

        func.coalesce(
            func.sum(
                case(
                    (flow.predicted_attack != "BENIGN", 1),
                    else_=0
                )
            ),
            0
        ).label("attacks"),

        func.coalesce(
            func.sum(
                case(
                    (flow.is_anomaly.is_(True), 1),
                    else_=0
                )
            ),
            0
        ).label("anomalies"),

    ).group_by(minute_expr).all()

    totals = defaultdict(
        lambda: {
            "flows": 0,
            "packets": 0,
            "bytes": 0,
            "attacks": 0,
            "anomalies": 0
        }
    )

    for row in rows:

        raw_time = row.minute

        timestamp = (
            datetime.fromisoformat(raw_time)
            if isinstance(raw_time, str)
            else raw_time
        )

        key = _floor_time(timestamp, bucket_minutes)

        item = totals[key]

        item["flows"] += int(row.flows or 0)
        item["packets"] += int(row.packets or 0)
        item["bytes"] += round(row.bytes or 0)
        item["attacks"] += int(row.attacks or 0)
        item["anomalies"] += int(row.anomalies or 0)

    return totals


# =========================================================
# OPTIONAL LIVE TSHARK SENSOR
# =========================================================

@router.get("/sensor/status")
def live_sensor_status(_=Depends(get_current_user)):
    """Status of the optional metadata-only tshark collector."""
    return sensor_status()


@router.post("/sensor/start")
async def start_sensor(
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    try:
        status = await start_live_sensor(request.app)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    log_action(db, admin, "live_sensor_started", f"interface={status['interface']}", request)
    return status


@router.post("/sensor/stop")
async def stop_sensor(
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_role("admin")),
):
    status = await stop_live_sensor(request.app)
    log_action(db, admin, "live_sensor_stopped", f"interface={status['interface']}", request)
    return status


# =========================================================
# NETWORK FLOW LIST
# =========================================================

@router.get(
    "/flows",
    response_model=list[schemas.FlowOut]
)
def list_flows(

    limit: int = Query(100, ge=1, le=500),

    attack: str | None = None,

    min_risk: int = Query(0, ge=0, le=100),

    threats_only: bool = False,

    src_ip: str | None = Query(None, max_length=64),

    dst_ip: str | None = Query(None, max_length=64),

    protocol: str | None = Query(None, max_length=20),

    port: int | None = Query(None, ge=1, le=65535),

    db: Session = Depends(get_db),

    _=Depends(get_current_user),

):

    query = db.query(models.TrafficFlow)

    query = _apply_flow_filters(
        query,
        src_ip=src_ip,
        dst_ip=dst_ip,
        protocol=protocol,
        port=port,
        attack=attack,
        min_risk=min_risk,
        threats_only=threats_only,
    )

    return (
        query
        .order_by(models.TrafficFlow.timestamp.desc())
        .limit(limit)
        .all()
    )


# =========================================================
# NETWORK TRAFFIC STATISTICS
# =========================================================

@router.get("/stats")
def traffic_stats(

    minutes: int = Query(
        60,
        ge=1,
        le=MAX_STATS_MINUTES
    ),

    bucket_minutes: int = Query(
        5,
        ge=1,
        le=60
    ),

    src_ip: str | None = Query(None, max_length=64),

    dst_ip: str | None = Query(None, max_length=64),

    protocol: str | None = Query(None, max_length=20),

    port: int | None = Query(None, ge=1, le=65535),

    attack: str | None = None,

    min_risk: int = Query(0, ge=0, le=100),

    threats_only: bool = False,

    db: Session = Depends(get_db),

    _=Depends(get_current_user),

):

    now = utcnow()
    since = now - timedelta(minutes=minutes)

    effective_bucket = max(
        bucket_minutes,
        math.ceil(minutes / (MAX_TIMELINE_POINTS - 1))
    )

    base = (
        db.query(models.TrafficFlow)
        .filter(models.TrafficFlow.timestamp >= since)
    )

    base = _apply_flow_filters(
        base,
        src_ip=src_ip,
        dst_ip=dst_ip,
        protocol=protocol,
        port=port,
        attack=attack,
        min_risk=min_risk,
        threats_only=threats_only,
    )

    flow = models.TrafficFlow

    # -----------------------------------------------------
    # 1. PROTOCOL ANALYSIS
    # -----------------------------------------------------

    protocol_rows = base.with_entities(

        flow.protocol.label("protocol"),

        func.count(flow.id).label("flows"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_packets, 0)
                + func.coalesce(flow.bwd_packets, 0)
            ),
            0
        ).label("packets"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_bytes, 0)
                + func.coalesce(flow.bwd_bytes, 0)
            ),
            0
        ).label("bytes"),

    ).group_by(flow.protocol).all()

    totals_by_protocol = {}
    unknown_protocols = Counter()

    for row in protocol_rows:

        name, raw_name, known = normalize_protocol(
            row.protocol
        )

        item = totals_by_protocol.setdefault(
            name,
            {
                "flows": 0,
                "packets": 0,
                "bytes": 0
            }
        )

        item["flows"] += int(row.flows or 0)
        item["packets"] += int(row.packets or 0)
        item["bytes"] += round(row.bytes or 0)

        if not known:
            unknown_protocols[raw_name] += int(row.flows or 0)

    total_flows = sum(
        item["flows"]
        for item in totals_by_protocol.values()
    )

    total_packets = sum(
        item["packets"]
        for item in totals_by_protocol.values()
    )

    total_bytes = sum(
        item["bytes"]
        for item in totals_by_protocol.values()
    )

    protocol_stats = []

    for name, values in sorted(
        totals_by_protocol.items(),
        key=lambda pair: (
            -pair[1]["flows"],
            pair[0]
        )
    ):

        unclassified = name == "OTHER"

        protocol_stats.append({

            "protocol": name,

            "classification": (
                "unclassified"
                if unclassified
                else "classified"
            ),

            "flows": values["flows"],
            "packets": values["packets"],
            "bytes": values["bytes"],

            "flow_percent": round(
                values["flows"] * 100 / total_flows,
                2
            ) if total_flows else 0,

            "packet_percent": round(
                values["packets"] * 100 / total_packets,
                2
            ) if total_packets else 0,

            "byte_percent": round(
                values["bytes"] * 100 / total_bytes,
                2
            ) if total_bytes else 0,

        })

    # -----------------------------------------------------
    # 2. TOP SOURCE IP ADDRESSES
    # -----------------------------------------------------

    top_sources = base.with_entities(

        flow.src_ip.label("ip"),

        func.count(flow.id).label("flows")

    ).group_by(
        flow.src_ip
    ).order_by(
        func.count(flow.id).desc()
    ).limit(8).all()

    # -----------------------------------------------------
    # 3. TOP DESTINATION IP ADDRESSES
    # -----------------------------------------------------

    top_destinations = base.with_entities(

        flow.dst_ip.label("ip"),

        func.count(flow.id).label("flows")

    ).group_by(
        flow.dst_ip
    ).order_by(
        func.count(flow.id).desc()
    ).limit(8).all()

    # -----------------------------------------------------
    # 4. TOP DESTINATION PORTS
    # -----------------------------------------------------

    top_ports = base.with_entities(

        flow.dst_port.label("port"),

        func.count(flow.id).label("flows")

    ).group_by(
        flow.dst_port
    ).order_by(
        func.count(flow.id).desc()
    ).limit(8).all()

    # -----------------------------------------------------
    # 5. INBOUND AND OUTBOUND TRAFFIC
    # -----------------------------------------------------

    networks = _internal_networks()

    direction = {
        key: {
            "flow_records": 0,
            "packets": 0,
            "bytes": 0
        }
        for key in (
            "inbound",
            "outbound",
            "east_west",
            "external",
            "undetermined"
        )
    }

    endpoint_rows = base.with_entities(

        flow.src_ip,
        flow.dst_ip,

        func.count(flow.id).label("flows"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_packets, 0)
                + func.coalesce(flow.bwd_packets, 0)
            ),
            0
        ).label("packets"),

        func.coalesce(
            func.sum(
                func.coalesce(flow.fwd_bytes, 0)
                + func.coalesce(flow.bwd_bytes, 0)
            ),
            0
        ).label("bytes"),

        func.coalesce(
            func.sum(flow.fwd_packets), 0
        ).label("fwd_packets"),

        func.coalesce(
            func.sum(flow.bwd_packets), 0
        ).label("bwd_packets"),

        func.coalesce(
            func.sum(flow.fwd_bytes), 0
        ).label("fwd_bytes"),

        func.coalesce(
            func.sum(flow.bwd_bytes), 0
        ).label("bwd_bytes"),

    ).group_by(
        flow.src_ip,
        flow.dst_ip
    ).all()

    for row in endpoint_rows:

        src_internal = _is_internal(row.src_ip, networks)
        dst_internal = _is_internal(row.dst_ip, networks)

        if src_internal is None or dst_internal is None:

            bucket = "undetermined"

            direction[bucket]["flow_records"] += int(row.flows or 0)
            direction[bucket]["packets"] += int(row.packets or 0)
            direction[bucket]["bytes"] += round(row.bytes or 0)

        elif src_internal and not dst_internal:

            # Forward: internal to external.
            direction["outbound"]["flow_records"] += int(row.flows or 0)
            direction["outbound"]["packets"] += int(row.fwd_packets or 0)
            direction["outbound"]["bytes"] += round(row.fwd_bytes or 0)

            # Backward: external reply.
            direction["inbound"]["flow_records"] += int(row.flows or 0)
            direction["inbound"]["packets"] += int(row.bwd_packets or 0)
            direction["inbound"]["bytes"] += round(row.bwd_bytes or 0)

        elif not src_internal and dst_internal:

            # Forward: external to internal.
            direction["inbound"]["flow_records"] += int(row.flows or 0)
            direction["inbound"]["packets"] += int(row.fwd_packets or 0)
            direction["inbound"]["bytes"] += round(row.fwd_bytes or 0)

            # Backward: internal reply.
            direction["outbound"]["flow_records"] += int(row.flows or 0)
            direction["outbound"]["packets"] += int(row.bwd_packets or 0)
            direction["outbound"]["bytes"] += round(row.bwd_bytes or 0)

        else:

            bucket = (
                "east_west"
                if src_internal and dst_internal
                else "external"
            )

            direction[bucket]["flow_records"] += int(row.flows or 0)
            direction[bucket]["packets"] += int(row.packets or 0)
            direction[bucket]["bytes"] += round(row.bytes or 0)

    # -----------------------------------------------------
    # 6. TRAFFIC TIMELINE
    # -----------------------------------------------------

    timeline_totals = _timeline_rows(
        base,
        effective_bucket
    )

    timeline_start = _floor_time(
        since,
        effective_bucket
    )

    timeline_end = _floor_time(
        now,
        effective_bucket
    )

    timeline = []
    cursor = timeline_start

    while cursor <= timeline_end:

        values = timeline_totals.get(cursor, {})

        timeline.append({

            "time": cursor.isoformat(),

            "flows": int(values.get("flows", 0)),

            "packets": int(values.get("packets", 0)),

            "bytes": int(values.get("bytes", 0)),

            "attacks": int(values.get("attacks", 0)),

            "anomalies": int(values.get("anomalies", 0)),

        })

        cursor += timedelta(minutes=effective_bucket)

    # -----------------------------------------------------
    # 7. BACKWARD COMPATIBILITY
    # -----------------------------------------------------

    protocols = {
        name: item["flows"]
        for name, item in totals_by_protocol.items()
    }

    return {

        # Original fields retained.
        "minutes": minutes,
        "flows": total_flows,
        "total_bytes": total_bytes,
        "total_packets": total_packets,
        "protocols": protocols,

        "top_sources": [
            {
                "ip": row.ip,
                "flows": int(row.flows)
            }
            for row in top_sources
        ],

        "top_ports": [
            {
                "port": row.port,
                "flows": int(row.flows)
            }
            for row in top_ports
        ],

        # Module 2 additions.
        "protocol_stats": protocol_stats,

        "unknown_protocols": [
            {
                "protocol": name,
                "flows": int(count)
            }
            for name, count in sorted(
                unknown_protocols.items(),
                key=lambda item: (-item[1], item[0])
            )
        ],

        "unknown_protocol_types": len(unknown_protocols),

        "unknown_protocol_flows": sum(
            unknown_protocols.values()
        ),

        "top_destinations": [
            {
                "ip": row.ip,
                "flows": int(row.flows)
            }
            for row in top_destinations
        ],

        "direction": {
            "method": "configured_internal_cidrs",
            "internal_cidrs": [
                str(network) for network in networks
            ],
            **direction,
        },

        "timeline": timeline,

        "bucket_minutes": effective_bucket,

    }


# =========================================================
# SINGLE FLOW AI ANALYSIS
# =========================================================

@router.post("/analyze")
def analyze_flow(
    body: schemas.FlowIn,
    _=Depends(get_current_user)
):
    return analyze(body.to_flow())


# =========================================================
# CSV UPLOAD
# =========================================================

@router.post("/upload")
async def upload_flows(

    request: Request,

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    user: models.User = Depends(require_role("analyst")),

):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            400,
            "Please upload a .csv file"
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_CSV_MEDIA_TYPES:
        raise HTTPException(415, "Unsupported file type. Upload a CSV file.")

    try:

        content = await file.read(MAX_UPLOAD_BYTES + 1)

        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                413,
                "CSV file exceeds the 10 MiB upload limit"
            )

        df = _read_upload_csv(content, file.filename)

    except HTTPException:
        raise

    except Exception as exc:
        logger.warning("Unexpected CSV parsing failure for upload %r: %s", file_name_for_log(file.filename), exc.__class__.__name__)
        raise HTTPException(
            400,
            "Could not read CSV. Check the file format, encoding, and CSV column headings."
        )

    finally:
        await file.close()

    if len(df) > MAX_UPLOAD_ROWS:
        raise HTTPException(
            413,
            f"CSV exceeds the {MAX_UPLOAD_ROWS}-row limit"
        )

    df.columns = [str(column).strip() for column in df.columns]
    df = _normalise_wireshark_headers(df)
    upload_source = "upload"
    capture_packets = None
    conversion_rejected = 0

    if _is_wireshark_packet_export(df):
        capture_packets = len(df)
        records, conversion_rejected, rejection_reasons = _wireshark_packet_rows(df)
        if not records:
            logger.warning(
                "Wireshark upload %r contained no valid packets; rejected=%d reasons=%s",
                file_name_for_log(file.filename),
                conversion_rejected,
                rejection_reasons,
            )
            raise HTTPException(400, "No valid packets were found in the Wireshark CSV export.")
        logger.info(
            "Wireshark upload %r: packets=%d flows=%d rejected=%d reasons=%s",
            file_name_for_log(file.filename),
            capture_packets,
            len(records),
            conversion_rejected,
            rejection_reasons,
        )
        df = pd.DataFrame(records)
        upload_source = "wireshark_csv"

    # CICIDS / CICFlowMeter conversion.
    if "Flow Duration" in df.columns:

        rename = {
            key: value
            for key, value in CICIDS_COLUMNS.items()
            if key in df.columns
        }

        rename.update({
            "Source IP": "src_ip",
            "Destination IP": "dst_ip",
            "Source Port": "src_port",
            "Destination Port": "dst_port",
            "Protocol": "protocol_num",
        })

        df = df.rename(columns=rename)

        if "duration" in df.columns:
            df["duration"] = df["duration"] / 1_000_000

    missing = [
        feature
        for feature in FEATURES
        if feature not in df.columns and feature != "protocol_num"
    ]

    if missing:
        raise HTTPException(
            400,
            f"CSV is missing columns: {', '.join(missing)}"
        )

    if "protocol_num" not in df.columns:

        if "protocol" in df.columns:

            protocol_numbers = {
                name: number
                for number, name in PROTOCOL_NAME.items()
            }

            df["protocol_num"] = (
                df["protocol"]
                .astype(str)
                .str.strip()
                .str.upper()
                .map(protocol_numbers)
                .fillna(0)
            )

        else:
            df["protocol_num"] = 6

    counts = Counter()
    rows_rejected = conversion_rejected
    failed_records = 0
    rows_processed = 0

    try:

        for record in df.to_dict(orient="records"):

            record = _clean_upload_record(record)
            if record is None:
                rows_rejected += 1
                continue

            try:
                protocol_number = int(
                    record.get("protocol_num", 6)
                )
            except (TypeError, ValueError):
                protocol_number = 0

            mapped_protocol = PROTOCOL_NAME.get(protocol_number)

            raw_protocol = record.get("protocol")

            if mapped_protocol:

                record["protocol"] = mapped_protocol

            elif (
                raw_protocol is not None
                and str(raw_protocol).strip()
                and not str(raw_protocol).strip().isdigit()
            ):

                record["protocol"] = (
                    str(raw_protocol).strip().upper()[:10]
                )

            elif protocol_number >= 0:

                record["protocol"] = f"IP_{protocol_number}"[:10]

            else:
                record["protocol"] = "OTHER"

            try:
                with db.begin_nested():
                    row = process_flow(
                        db,
                        record,
                        source=upload_source,
                        commit=False
                    )
                    counts[row.predicted_attack] += 1
                    rows_processed += 1
            except Exception:
                failed_records += 1

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            400,
            "CSV processing failed. No rows from this upload were committed."
        )

    log_action(
        db,
        user,
        "traffic_uploaded",
        (
            f"{file.filename}: {rows_processed} processed, "
            f"{rows_rejected} rejected, {failed_records} failed"
        ),
        request
    )

    return {
        "rows_processed": rows_processed,
        "rows_rejected": rows_rejected,
        "failed_records": failed_records,
        "capture_packets": capture_packets,
        "ingestion_source": upload_source,
        "predictions": dict(counts),
    }
