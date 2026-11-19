
from datetime import datetime, timedelta, timezone
import os
import socket

import psutil

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.network_models import NetworkCaptureSession, NetworkPacket
from app.services.network_capture import network_capture_manager


router = APIRouter(prefix="/network", tags=["Network Monitoring"])

VIEW_ROLES = (
    "Administrator",
    "Security Analyst",
    "Team Lead / Supervisor",
)

CONTROL_ROLES = ("Administrator", "Security Analyst")


class CaptureStartRequest(BaseModel):
    interface_index: int = Field(ge=1)


def get_capture_or_404(db: Session, capture_id: int):
    capture = db.get(NetworkCaptureSession, capture_id)

    if capture is None:
        raise HTTPException(404, "Capture session not found.")

    return capture


def get_window_filters(capture_id: int, window_minutes: int):
    start_time = datetime.now(timezone.utc) - timedelta(
        minutes=window_minutes
    )

    return [
        NetworkPacket.capture_id == capture_id,
        NetworkPacket.captured_at >= start_time,
    ]


def validate_window_minutes(window_minutes: int = Query(default=60)):
    if window_minutes not in (15, 30, 60, 120):
        raise HTTPException(
            status_code=422,
            detail="window_minutes must be 15, 30, 60 or 120.",
        )
    return window_minutes

def get_interface_ips(interface_name: str):
    addresses = []

    for address in psutil.net_if_addrs().get(interface_name, []):
        if address.family in (socket.AF_INET, socket.AF_INET6):
            value = address.address.split("%")[0]

            if value:
                addresses.append(value)

    return addresses


def get_aggregate(db: Session, filters):
    row = db.execute(
        select(
            func.count(NetworkPacket.id),
            func.coalesce(func.sum(NetworkPacket.packet_length), 0),
        ).where(*filters)
    ).one()

    return {
        "total_packets": int(row[0]),
        "total_bytes": int(row[1]),
    }


def get_top_ips(db: Session, column, filters):
    rows = db.execute(
        select(
            column.label("ip_address"),
            func.count(NetworkPacket.id).label("packet_count"),
            func.coalesce(
                func.sum(NetworkPacket.packet_length), 0
            ).label("total_bytes"),
        )
        .where(*filters, column.is_not(None))
        .group_by(column)
        .order_by(func.sum(NetworkPacket.packet_length).desc())
        .limit(10)
    ).all()

    return [
        {
            "ip_address": row.ip_address,
            "packet_count": int(row.packet_count),
            "total_bytes": int(row.total_bytes),
        }
        for row in rows
    ]


# ---------------------------------------------------------
# INTERFACE DISCOVERY
# ---------------------------------------------------------

@router.get("/interfaces")
def list_network_interfaces(
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    try:
        return {
            "interfaces": network_capture_manager.get_interfaces()
        }
    except (RuntimeError, FileNotFoundError) as exc:
        raise HTTPException(503, str(exc)) from exc


# ---------------------------------------------------------
# CAPTURE CONTROL
# ---------------------------------------------------------

@router.post("/captures/start")
def start_network_capture(
    data: CaptureStartRequest,
    current_user=Depends(require_roles(*CONTROL_ROLES)),
):
    try:
        return network_capture_manager.start_capture(
            interface_index=data.interface_index,
            started_by_id=current_user.id,
        )
    except (ValueError, RuntimeError, FileNotFoundError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/captures/{capture_id}/stop")
def stop_network_capture(
    capture_id: int,
    current_user=Depends(require_roles(*CONTROL_ROLES)),
):
    current_status = network_capture_manager.get_status()

    if (
        not current_status["running"]
        or current_status["capture_id"] != capture_id
    ):
        raise HTTPException(
            404,
            "This capture is not currently running.",
        )

    return network_capture_manager.stop_capture()


@router.get("/captures/status")
def get_network_capture_status(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    status_data = network_capture_manager.get_status()

    if not status_data["capture_id"]:
        return {
            **status_data,
            "packet_count": 0,
            "total_bytes": 0,
        }

    capture = get_capture_or_404(
        db, status_data["capture_id"]
    )

    totals = get_aggregate(
        db,
        [NetworkPacket.capture_id == capture.id],
    )

    return {
        **status_data,
        "status": capture.status,
        "started_at": capture.started_at,
        **totals,
    }


@router.get("/captures")
def list_capture_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    sessions = db.scalars(
        select(NetworkCaptureSession)
        .order_by(NetworkCaptureSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    total = db.scalar(
        select(func.count(NetworkCaptureSession.id))
    ) or 0

    items = []

    for session in sessions:
        totals = get_aggregate(
            db,
            [NetworkPacket.capture_id == session.id],
        )

        items.append({
            "id": session.id,
            "interface_id": session.interface_id,
            "interface_name": session.interface_name,
            "status": session.status,
            "started_at": session.started_at,
            "stopped_at": session.stopped_at,
            **totals,
            "error_message": session.error_message,
        })

    return {"total": total, "items": items}


# ---------------------------------------------------------
# ---------------------------------------------------------
# SYSTEM HEALTH
# ---------------------------------------------------------

@router.get("/system-health")
def get_system_health(
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(os.path.abspath(os.sep))
        network = psutil.net_io_counters()

        return {
            "cpu_percent": psutil.cpu_percent(interval=0.3),
            "memory_percent": memory.percent,
            "memory_used_bytes": memory.used,
            "memory_total_bytes": memory.total,
            "disk_percent": disk.percent,
            "disk_used_bytes": disk.used,
            "disk_total_bytes": disk.total,
            "network_bytes_sent": network.bytes_sent,
            "network_bytes_received": network.bytes_recv,
            "timestamp": datetime.now(timezone.utc),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to retrieve system health: {exc}",
        ) from exc

# TASK 2: TRAFFIC MONITORING SUMMARY
# ---------------------------------------------------------

@router.get("/captures/{capture_id}/summary")
def get_traffic_summary(
    capture_id: int,
    window_minutes: int = Depends(validate_window_minutes),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    capture = get_capture_or_404(db, capture_id)
    filters = get_window_filters(capture_id, window_minutes)

    totals = get_aggregate(db, filters)

    source_ips = set(
        db.scalars(
            select(NetworkPacket.source_ip)
            .where(*filters, NetworkPacket.source_ip.is_not(None))
            .distinct()
        ).all()
    )

    destination_ips = set(
        db.scalars(
            select(NetworkPacket.destination_ip)
            .where(
                *filters,
                NetworkPacket.destination_ip.is_not(None),
            )
            .distinct()
        ).all()
    )

    local_ips = get_interface_ips(capture.interface_name)

    direction = {
        "incoming": {"packets": 0, "bytes": 0},
        "outgoing": {"packets": 0, "bytes": 0},
        "unknown": {"packets": 0, "bytes": 0},
    }

    if local_ips:
        direction_expression = case(
            (
                NetworkPacket.source_ip.in_(local_ips),
                "outgoing",
            ),
            (
                NetworkPacket.destination_ip.in_(local_ips),
                "incoming",
            ),
            else_="unknown",
        )

        rows = db.execute(
            select(
                direction_expression,
                func.count(NetworkPacket.id),
                func.coalesce(
                    func.sum(NetworkPacket.packet_length), 0
                ),
            )
            .where(*filters)
            .group_by(direction_expression)
        ).all()

        for row in rows:
            direction[row[0]] = {
                "packets": int(row[1]),
                "bytes": int(row[2]),
            }
    else:
        direction["unknown"] = {
            "packets": totals["total_packets"],
            "bytes": totals["total_bytes"],
        }

    return {
        "capture_id": capture_id,
        "interface_name": capture.interface_name,
        "window_minutes": window_minutes,
        **totals,
        "unique_source_ips": len(source_ips),
        "unique_destination_ips": len(destination_ips),
        "unique_hosts": len(source_ips | destination_ips),
        "top_source_ips": get_top_ips(
            db, NetworkPacket.source_ip, filters
        ),
        "top_destination_ips": get_top_ips(
            db, NetworkPacket.destination_ip, filters
        ),
        "local_interface_ips": local_ips,
        "direction_available": bool(local_ips),
        "incoming": direction["incoming"],
        "outgoing": direction["outgoing"],
        "unknown_direction": direction["unknown"],
    }


# ---------------------------------------------------------
# TASK 3: PROTOCOL ANALYSIS
# ---------------------------------------------------------

@router.get("/captures/{capture_id}/protocol-stats")
def get_protocol_statistics(
    capture_id: int,
    window_minutes: int = Depends(validate_window_minutes),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    get_capture_or_404(db, capture_id)
    filters = get_window_filters(capture_id, window_minutes)

    rows = db.execute(
        select(
            NetworkPacket.protocol,
            func.count(NetworkPacket.id),
            func.coalesce(
                func.sum(NetworkPacket.packet_length), 0
            ),
        )
        .where(*filters)
        .group_by(NetworkPacket.protocol)
        .order_by(func.count(NetworkPacket.id).desc())
    ).all()

    total_packets = sum(row[1] for row in rows)
    total_bytes = sum(int(row[2]) for row in rows)

    return {
        "capture_id": capture_id,
        "window_minutes": window_minutes,
        "total_packets": total_packets,
        "total_bytes": total_bytes,
        "protocols": [
            {
                "protocol": row[0] or "UNKNOWN",
                "packet_count": int(row[1]),
                "total_bytes": int(row[2]),
                "packet_percentage": round(
                    row[1] / total_packets * 100, 2
                ) if total_packets else 0,
                "byte_percentage": round(
                    int(row[2]) / total_bytes * 100, 2
                ) if total_bytes else 0,
            }
            for row in rows
        ],
    }


# ---------------------------------------------------------
# TASK 2: TRAFFIC ACTIVITY OVER TIME
# ---------------------------------------------------------

@router.get("/captures/{capture_id}/traffic-timeline")
def get_traffic_timeline(
    capture_id: int,
    window_minutes: int = Depends(validate_window_minutes),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    get_capture_or_404(db, capture_id)
    filters = get_window_filters(capture_id, window_minutes)

    bucket = func.date_trunc(
        "minute",
        NetworkPacket.captured_at,
    )

    rows = db.execute(
        select(
            bucket,
            func.count(NetworkPacket.id),
            func.coalesce(
                func.sum(NetworkPacket.packet_length), 0
            ),
        )
        .where(*filters)
        .group_by(bucket)
        .order_by(bucket)
    ).all()

    return {
        "capture_id": capture_id,
        "window_minutes": window_minutes,
        "interval": "one_minute",
        "points": [
            {
                "timestamp": row[0],
                "packet_count": int(row[1]),
                "total_bytes": int(row[2]),
            }
            for row in rows
        ],
    }


# ---------------------------------------------------------
# PACKET SEARCH AND FILTERS
# ---------------------------------------------------------

@router.get("/captures/{capture_id}/packets")
def get_capture_packets(
    capture_id: int,
    source_ip: str | None = Query(default=None, max_length=45),
    destination_ip: str | None = Query(default=None, max_length=45),
    protocol: str | None = Query(default=None, max_length=64),
    port: int | None = Query(default=None, ge=0, le=65535),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    get_capture_or_404(db, capture_id)

    if start_date and start_date.tzinfo is None:
        raise HTTPException(
            400,
            "Start date must include timezone information.",
        )

    if end_date and end_date.tzinfo is None:
        raise HTTPException(
            400,
            "End date must include timezone information.",
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            400,
            "Start date cannot be later than end date.",
        )

    query = select(NetworkPacket).where(
        NetworkPacket.capture_id == capture_id
    )

    if source_ip:
        query = query.where(
            NetworkPacket.source_ip == source_ip.strip()
        )

    if destination_ip:
        query = query.where(
            NetworkPacket.destination_ip == destination_ip.strip()
        )

    if protocol:
        query = query.where(
            NetworkPacket.protocol.ilike(protocol.strip())
        )

    if port is not None:
        query = query.where(
            or_(
                NetworkPacket.source_port == port,
                NetworkPacket.destination_port == port,
            )
        )

    if start_date:
        query = query.where(
            NetworkPacket.captured_at >= start_date
        )

    if end_date:
        query = query.where(
            NetworkPacket.captured_at <= end_date
        )

    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    packets = db.scalars(
        query
        .order_by(
            NetworkPacket.captured_at.desc(),
            NetworkPacket.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "capture_id": capture_id,
        "total": int(total),
        "items": [
            {
                "id": packet.id,
                "captured_at": packet.captured_at,
                "source_ip": packet.source_ip,
                "destination_ip": packet.destination_ip,
                "protocol": packet.protocol,
                "source_port": packet.source_port,
                "destination_port": packet.destination_port,
                "packet_length": packet.packet_length,
                "protocol_stack": packet.protocol_stack,
                "interface_name": packet.interface_name,
            }
            for packet in packets
        ],
    }

