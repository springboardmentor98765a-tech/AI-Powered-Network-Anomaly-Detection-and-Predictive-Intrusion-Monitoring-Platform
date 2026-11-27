from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.audit import log_audit_event
from app.api.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models import AnomalyRecord, NetworkFlow, SuspiciousReport, User
from app.schemas import (
    AnomalyOverviewResponse,
    BehaviorRow,
    RegularPatternItem,
    SuspiciousReportAction,
    SuspiciousReportCreate,
    SuspiciousReportResponse,
)

router = APIRouter(prefix="/api/anomaly", tags=["AI Anomaly Detection"])

RESTRICTED_CLEARANCE_PORTS = {22, 445, 3389, 5432, 6379}
BASELINE_KNOWN_IPS = {
    "192.168.1.1",
    "192.168.1.10",
    "192.168.1.15",
    "192.168.1.18",
    "192.168.1.22",
    "104.21.44.12",
    "8.8.8.8",
    "1.1.1.1",
    "172.217.16.14",
    "45.33.32.156",
}


def _recompute_anomalies_from_flows(db: Session) -> None:
    flows = db.query(NetworkFlow).order_by(NetworkFlow.timestamp.asc()).all()
    if not flows:
        return

    ip_freq = defaultdict(int)
    for f in flows:
        ip_freq[f.source_ip] += 1
        ip_freq[f.destination_ip] += 1

    try:
        # Detach foreign key references before deleting stale anomaly records
        db.query(SuspiciousReport).filter(SuspiciousReport.anomaly_id.isnot(None)).update(
            {SuspiciousReport.anomaly_id: None},
            synchronize_session=False,
        )

        # Clear previous auto-generated records and rebuild cleanly from flow telemetry
        db.query(AnomalyRecord).delete(synchronize_session=False)
        db.flush()

        created: list[AnomalyRecord] = []
        for f in flows:
            plen = f.packet_length or 64
            dur_sec = max((f.flow_duration or 10.0) / 1000.0, 0.01)
            pps = round(1.0 / dur_sec, 2)
            syn_ratio = (
                0.88
                if (f.flag and "SYN" in f.flag.upper())
                else (0.12 if f.protocol == "TCP" else 0.0)
            )

            is_new_ip = (
                1 if (f.source_ip not in BASELINE_KNOWN_IPS or ip_freq[f.source_ip] == 1) else 0
            )
            unauth_clearance = (
                1
                if (
                    f.destination_port in RESTRICTED_CLEARANCE_PORTS
                    and not f.source_ip.startswith("192.168.1.1")
                )
                else 0
            )

            # Behavioral profile description using technical networking terms
            if f.protocol == "TCP" and syn_ratio > 0.7:
                profile = "High-SYN Half-Open Handshake / Probe"
            elif f.destination_port in RESTRICTED_CLEARANCE_PORTS:
                profile = "Privileged Service Socket Access"
            elif plen > 3000:
                profile = "Large Payload / Egress Burst"
            elif f.protocol in {"DNS", "ARP", "ICMP"}:
                profile = "Control-Plane / Link-Layer Telemetry"
            else:
                profile = "Standard Stateful Session Flow"

            triggers = []
            if is_new_ip:
                triggers.append("New Unseen IP")
            if unauth_clearance:
                triggers.append(f"Clearance Escalation (Port {f.destination_port})")
            if f.status != "NORMAL":
                triggers.append("Heuristic Flow Flag")
            if not triggers:
                triggers.append("Within Baseline")

            # Risk scoring (0 - 100) and classification
            score = 15
            if is_new_ip:
                score += 28
            if unauth_clearance:
                score += 37
            if f.status != "NORMAL":
                score += 15
            if plen > 4000:
                score += 10
            score = min(score, 99)

            if score >= 70 or (is_new_ip and unauth_clearance):
                classification = "DANGEROUS"
                risk_level = "Critical" if score >= 85 else "High"
                rationale = (
                    f"Elevated behavioral risk ({score}/100): "
                    + (", ".join(triggers))
                    + f" on {f.protocol}:{f.destination_port} with SYN ratio {syn_ratio:.2f}."
                )
            elif score >= 40 or is_new_ip or unauth_clearance:
                classification = "RISK_ASSESSED"
                risk_level = "Medium"
                rationale = (
                    f"Moderate risk ({score}/100) requiring analyst verification: "
                    + (", ".join(triggers))
                    + "."
                )
            else:
                classification = "MISTAKE"
                risk_level = "Low"
                rationale = (
                    f"Low risk ({score}/100): Likely benign misconfiguration, retry, or routine traffic "
                    f"on {f.protocol}:{f.destination_port}."
                )

            created.append(
                AnomalyRecord(
                    source_ip=f.source_ip,
                    destination_ip=f.destination_ip,
                    protocol=f.protocol,
                    destination_port=f.destination_port or 0,
                    packet_count=1,
                    total_bytes=plen,
                    avg_packet_size=float(plen),
                    flow_rate_pps=pps,
                    syn_ratio=syn_ratio,
                    behavioral_profile=profile,
                    detection_trigger=" + ".join(triggers),
                    is_new_ip=is_new_ip,
                    unauthorized_clearance=unauth_clearance,
                    risk_score=score,
                    risk_level=risk_level,
                    classification=classification,
                    rationale=rationale,
                    detected_at=f.timestamp or datetime.utcnow(),
                )
            )

        db.add_all(created)
        db.commit()
    except Exception:
        db.rollback()
        raise


def _to_behavior_row(rec: AnomalyRecord) -> BehaviorRow:
    return BehaviorRow(
        id=rec.id,
        source_ip=rec.source_ip,
        destination_ip=rec.destination_ip,
        protocol=rec.protocol,
        destination_port=rec.destination_port,
        packet_count=rec.packet_count,
        total_bytes=rec.total_bytes,
        avg_packet_size=rec.avg_packet_size,
        flow_rate_pps=rec.flow_rate_pps,
        syn_ratio=rec.syn_ratio,
        behavioral_profile=rec.behavioral_profile,
        detection_trigger=rec.detection_trigger,
        is_new_ip=bool(rec.is_new_ip),
        unauthorized_clearance=bool(rec.unauthorized_clearance),
        risk_score=rec.risk_score,
        risk_level=rec.risk_level,
        classification=rec.classification,
        rationale=rec.rationale,
    )


@router.get("/overview", response_model=AnomalyOverviewResponse)
def get_anomaly_overview(
    refresh: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if refresh or db.query(AnomalyRecord).count() == 0:
        _recompute_anomalies_from_flows(db)

    records = (
        db.query(AnomalyRecord)
        .order_by(AnomalyRecord.risk_score.desc(), AnomalyRecord.id.desc())
        .all()
    )
    behaviors = [_to_behavior_row(r) for r in records]

    suspicious_detections = [
        b
        for b in behaviors
        if b.is_new_ip or b.unauthorized_clearance or b.classification != "MISTAKE"
    ]

    # Pattern recognition: regular IPs and recurring packet transfers
    flows = db.query(NetworkFlow).all()
    src_stats = defaultdict(lambda: {"count": 0, "bytes": 0, "proto": "TCP", "port": 0})
    dst_stats = defaultdict(lambda: {"count": 0, "bytes": 0, "proto": "TCP", "port": 0})
    pair_stats = defaultdict(lambda: {"count": 0, "bytes": 0, "proto": "TCP", "port": 0})

    for f in flows:
        b = f.packet_length or 0
        src_stats[f.source_ip]["count"] += 1
        src_stats[f.source_ip]["bytes"] += b
        src_stats[f.source_ip]["proto"] = f.protocol
        src_stats[f.source_ip]["port"] = f.destination_port or 0

        dst_stats[f.destination_ip]["count"] += 1
        dst_stats[f.destination_ip]["bytes"] += b
        dst_stats[f.destination_ip]["proto"] = f.protocol
        dst_stats[f.destination_ip]["port"] = f.destination_port or 0

        pair_key = f"{f.source_ip} -> {f.destination_ip}"
        pair_stats[pair_key]["count"] += 1
        pair_stats[pair_key]["bytes"] += b
        pair_stats[pair_key]["proto"] = f.protocol
        pair_stats[pair_key]["port"] = f.destination_port or 0

    regular_patterns: list[RegularPatternItem] = []
    for ip, st in sorted(src_stats.items(), key=lambda x: x[1]["count"], reverse=True)[:4]:
        regular_patterns.append(
            RegularPatternItem(
                pattern_key=f"SRC-{ip}",
                ip_address=ip,
                role="Regular Source IP",
                protocol=st["proto"],
                port=st["port"],
                avg_bytes=round(st["bytes"] / max(st["count"], 1), 1),
                frequency=st["count"],
                cadence="Recurring Egress Baseline",
            )
        )

    for ip, st in sorted(dst_stats.items(), key=lambda x: x[1]["count"], reverse=True)[:4]:
        regular_patterns.append(
            RegularPatternItem(
                pattern_key=f"DST-{ip}",
                ip_address=ip,
                role="Regular Destination IP",
                protocol=st["proto"],
                port=st["port"],
                avg_bytes=round(st["bytes"] / max(st["count"], 1), 1),
                frequency=st["count"],
                cadence="Steady Service Endpoint",
            )
        )

    for pair, st in sorted(pair_stats.items(), key=lambda x: x[1]["count"], reverse=True)[:4]:
        regular_patterns.append(
            RegularPatternItem(
                pattern_key=f"FLOW-{pair}",
                ip_address=pair,
                role="Recurring Packet Transfer",
                protocol=st["proto"],
                port=st["port"],
                avg_bytes=round(st["bytes"] / max(st["count"], 1), 1),
                frequency=st["count"],
                cadence="Periodic Telemetry Exchange",
            )
        )

    reports = db.query(SuspiciousReport).order_by(SuspiciousReport.created_at.desc()).all()

    return AnomalyOverviewResponse(
        behaviors=behaviors,
        suspicious_detections=suspicious_detections,
        regular_patterns=regular_patterns,
        classifications=behaviors,
        reports=reports,
    )


@router.post("/reports", response_model=SuspiciousReportResponse)
def report_suspicious_activity(
    body: SuspiciousReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = SuspiciousReport(
        anomaly_id=body.anomaly_id,
        reported_by_user_id=current_user.id,
        reported_by_name=current_user.name or current_user.email,
        source_ip=body.source_ip,
        destination_ip=body.destination_ip,
        reason=body.reason,
        clearance_violation=body.clearance_violation or "None",
        severity=body.severity or "Medium",
        status="PENDING_LEAD_REVIEW",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="SUSPICIOUS_ACTIVITY_REPORTED",
        target_type="SUSPICIOUS_REPORT",
        status="SUCCESS",
        details={
            "report_id": report.id,
            "source_ip": report.source_ip,
            "severity": report.severity,
        },
    )
    return report


@router.post("/reports/{report_id}/resolve", response_model=SuspiciousReportResponse)
def resolve_suspicious_report(
    report_id: int,
    body: SuspiciousReportAction,
    current_user: User = Depends(require_roles(["Team Lead", "Administrator"])),
    db: Session = Depends(get_db),
):
    decision = body.decision.upper()
    if decision not in {"ACTION_TAKEN", "DISMISSED"}:
        raise HTTPException(status_code=400, detail="Decision must be ACTION_TAKEN or DISMISSED")

    report = db.query(SuspiciousReport).filter(SuspiciousReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Suspicious report not found")

    report.status = decision
    report.assigned_lead_id = current_user.id
    report.lead_resolution_note = body.note or (
        "Action initiated by Team Lead."
        if decision == "ACTION_TAKEN"
        else "Dismissed as non-actionable by Team Lead."
    )
    db.commit()
    db.refresh(report)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action=f"SUSPICIOUS_REPORT_{decision}",
        target_type="SUSPICIOUS_REPORT",
        status="SUCCESS",
        details={"report_id": report.id, "decision": decision},
    )
    return report