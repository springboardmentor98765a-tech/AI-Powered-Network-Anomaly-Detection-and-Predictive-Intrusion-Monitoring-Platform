from collections import defaultdict
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address

from sqlalchemy import (
    case,
    distinct,
    func,
    literal,
    select,
    union_all,
)
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.network_models import NetworkPacket


BASELINE_DAYS = 7
PATTERN_LOOKBACK_DAYS = 30


def utc_now():
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _safe_ip_scope(value: str | None) -> str:
    if not value:
        return "UNKNOWN"
    try:
        parsed = ip_address(value)
        if parsed.is_loopback:
            return "LOOPBACK"
        if parsed.is_link_local:
            return "LINK_LOCAL"
        if parsed.is_global:
            return "PUBLIC"
        if parsed.is_private:
            return "PRIVATE"
        return "NON_GLOBAL"
    except ValueError:
        return "UNKNOWN"


def _risk_level(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 65:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    if score >= 15:
        return "LOW"
    return "INFORMATIONAL"


def _finding(
    *,
    finding_type: str,
    classification: str,
    title: str,
    description: str,
    source_ip: str | None,
    risk_score: int,
    evidence: dict,
    detected_at: datetime | None = None,
):
    score = max(0, min(100, int(risk_score)))
    level = _risk_level(score)
    assessment = (
        "Potentially dangerous - requires investigation"
        if score >= 65
        else "Review recommended - not proof of malicious activity"
        if score >= 15
        else "Likely routine or low-impact event"
    )
    return {
        "finding_type": finding_type,
        "classification": classification,
        "title": title,
        "description": description,
        "source_ip": source_ip,
        "risk_score": score,
        "risk_level": level,
        "assessment": assessment,
        "evidence": evidence,
        "detected_at": _as_utc(detected_at) if detected_at else utc_now(),
    }


def _network_behavior(db: Session, window_start: datetime, window_minutes: int):
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
        .where(NetworkPacket.captured_at >= window_start)
        .group_by(
            NetworkPacket.source_ip,
            NetworkPacket.destination_ip,
            NetworkPacket.protocol,
            NetworkPacket.source_port,
            NetworkPacket.destination_port,
        )
        .order_by(func.count(NetworkPacket.id).desc())
        .limit(150)
    ).all()

    items = []
    for row in rows:
        span_seconds = max(
            1.0,
            (row.last_seen - row.first_seen).total_seconds()
            if row.first_seen and row.last_seen
            else float(window_minutes * 60),
        )
        items.append({
            "source_ip": row.source_ip,
            "destination_ip": row.destination_ip,
            "protocol": row.protocol or "UNKNOWN",
            "source_port": row.source_port,
            "destination_port": row.destination_port,
            "packet_count": int(row.packet_count),
            "total_bytes": int(row.total_bytes or 0),
            "average_packet_size": round(float(row.average_packet_size or 0), 2),
            "packets_per_second": round(int(row.packet_count) / span_seconds, 3),
            "first_seen": row.first_seen,
            "last_seen": row.last_seen,
        })
    return items


def _ip_observations(db: Session, since: datetime | None = None):
    source_filter = [NetworkPacket.source_ip.is_not(None)]
    destination_filter = [NetworkPacket.destination_ip.is_not(None)]
    if since is not None:
        source_filter.append(NetworkPacket.captured_at >= since)
        destination_filter.append(NetworkPacket.captured_at >= since)

    source_rows = select(
        NetworkPacket.source_ip.label("ip_address"),
        NetworkPacket.captured_at.label("observed_at"),
        NetworkPacket.packet_length.label("packet_length"),
        NetworkPacket.capture_id.label("capture_id"),
        literal("SOURCE").label("direction"),
    ).where(*source_filter)

    destination_rows = select(
        NetworkPacket.destination_ip.label("ip_address"),
        NetworkPacket.captured_at.label("observed_at"),
        NetworkPacket.packet_length.label("packet_length"),
        NetworkPacket.capture_id.label("capture_id"),
        literal("DESTINATION").label("direction"),
    ).where(*destination_filter)

    observations = union_all(source_rows, destination_rows).subquery("ip_observations")

    return db.execute(
        select(
            observations.c.ip_address,
            func.min(observations.c.observed_at).label("first_seen"),
            func.max(observations.c.observed_at).label("last_seen"),
            func.count().label("observations"),
            func.coalesce(func.sum(observations.c.packet_length), 0).label("observed_bytes"),
            func.count(distinct(func.date_trunc("day", observations.c.observed_at))).label("active_days"),
            func.count(distinct(observations.c.capture_id)).label("capture_sessions"),
            func.sum(case((observations.c.direction == "SOURCE", 1), else_=0)).label("source_observations"),
            func.sum(case((observations.c.direction == "DESTINATION", 1), else_=0)).label("destination_observations"),
        )
        .group_by(observations.c.ip_address)
        .order_by(func.count().desc())
    ).all()


def _ip_patterns(ip_rows):
    items = []
    for row in ip_rows:
        active_days = int(row.active_days or 0)
        capture_sessions = int(row.capture_sessions or 0)
        if active_days < 2 and capture_sessions < 2:
            continue
        items.append({
            "ip_address": row.ip_address,
            "scope": _safe_ip_scope(row.ip_address),
            "observations": int(row.observations),
            "observed_bytes": int(row.observed_bytes or 0),
            "source_observations": int(row.source_observations or 0),
            "destination_observations": int(row.destination_observations or 0),
            "active_days": active_days,
            "capture_sessions": capture_sessions,
            "average_observations_per_session": round(
                int(row.observations) / max(capture_sessions, 1), 2
            ),
            "first_seen": row.first_seen,
            "last_seen": row.last_seen,
            "recurrence_basis": "multiple capture sessions" if capture_sessions >= 2 else "multiple active days",
        })
    return items


def _flow_patterns(db: Session, now: datetime):
    start = now - timedelta(days=PATTERN_LOOKBACK_DAYS)
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
            func.count(distinct(func.date_trunc("day", NetworkPacket.captured_at))).label("active_days"),
            func.count(distinct(NetworkPacket.capture_id)).label("capture_sessions"),
            func.min(NetworkPacket.captured_at).label("first_seen"),
            func.max(NetworkPacket.captured_at).label("last_seen"),
        )
        .where(NetworkPacket.captured_at >= start)
        .group_by(
            NetworkPacket.source_ip,
            NetworkPacket.destination_ip,
            NetworkPacket.protocol,
            NetworkPacket.source_port,
            NetworkPacket.destination_port,
        )
        .having(func.count(NetworkPacket.id) >= 3)
        .order_by(func.count(NetworkPacket.id).desc())
        .limit(200)
    ).all()

    patterns = []
    provisional = []
    for row in rows:
        sessions = int(row.capture_sessions or 0)
        days = int(row.active_days or 0)
        item = {
            "source_ip": row.source_ip,
            "destination_ip": row.destination_ip,
            "protocol": row.protocol or "UNKNOWN",
            "source_port": row.source_port,
            "destination_port": row.destination_port,
            "packet_count": int(row.packet_count),
            "total_bytes": int(row.total_bytes or 0),
            "average_packet_size": round(float(row.average_packet_size or 0), 2),
            "active_days": days,
            "capture_sessions": sessions,
            "average_packets_per_session": round(int(row.packet_count) / max(sessions, 1), 2),
            "first_seen": row.first_seen,
            "last_seen": row.last_seen,
            "recurrence_basis": "multiple capture sessions" if sessions >= 2 else "multiple active days" if days >= 2 else "repeated within one capture",
        }
        if sessions >= 2 or days >= 2:
            patterns.append(item)
        else:
            provisional.append(item)

    return patterns, provisional


def _source_statistics(db: Session, window_start: datetime, baseline_start: datetime):
    current_minute = func.date_trunc("minute", NetworkPacket.captured_at)
    current_rows = db.execute(
        select(
            NetworkPacket.source_ip,
            func.count(NetworkPacket.id).label("packet_count"),
            func.coalesce(func.sum(NetworkPacket.packet_length), 0).label("total_bytes"),
            func.count(distinct(NetworkPacket.destination_ip)).label("unique_destinations"),
            func.count(distinct(NetworkPacket.destination_port)).label("unique_destination_ports"),
            func.count(distinct(current_minute)).label("active_minutes"),
        )
        .where(
            NetworkPacket.captured_at >= window_start,
            NetworkPacket.source_ip.is_not(None),
        )
        .group_by(NetworkPacket.source_ip)
    ).all()

    baseline_minute = func.date_trunc("minute", NetworkPacket.captured_at)
    baseline_rows = db.execute(
        select(
            NetworkPacket.source_ip,
            func.count(NetworkPacket.id).label("packet_count"),
            func.count(distinct(baseline_minute)).label("active_minutes"),
        )
        .where(
            NetworkPacket.captured_at >= baseline_start,
            NetworkPacket.captured_at < window_start,
            NetworkPacket.source_ip.is_not(None),
        )
        .group_by(NetworkPacket.source_ip)
    ).all()
    baseline = {
        row.source_ip: {
            "packet_count": int(row.packet_count),
            "active_minutes": int(row.active_minutes or 0),
        }
        for row in baseline_rows
    }
    return current_rows, baseline


def _access_denial_findings(db: Session, window_start: datetime):
    """Group role-based and data-clearance denials into explainable findings."""
    logs = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.action.in_(("ACCESS_DENIED", "DATA_CLEARANCE_DENIED")),
            AuditLog.status == "FAILED",
            AuditLog.timestamp >= window_start,
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(500)
    ).all()

    grouped = defaultdict(list)
    for log in logs:
        details = log.details or {}
        group_key = (
            log.action,
            log.actor_user_id,
            details.get("client_ip"),
            details.get("path"),
            details.get("resource_id"),
        )
        grouped[group_key].append(log)

    findings = []
    activity_rows = []
    for (action, user_id, client_ip, path, resource_id), entries in grouped.items():
        count = len(entries)
        latest = entries[0]
        details = latest.details or {}
        actor = f"user #{user_id}" if user_id else "unknown user"
        is_clearance = action == "DATA_CLEARANCE_DENIED"

        if is_clearance:
            if count >= 2:
                score = 90
                classification = "REPEATED_DATA_CLEARANCE_VIOLATION_ATTEMPTS"
                title = "Repeated attempts above data clearance"
            else:
                score = 72
                classification = "DATA_CLEARANCE_VIOLATION_ATTEMPT"
                title = "Attempt to access data above clearance"
            description = (
                f"{count} attempt(s) by {actor} to access {details.get('resource_name') or 'a protected resource'} "
                f"were denied. Required clearance: {details.get('required_clearance_label', 'higher clearance')} "
                f"(Level {details.get('required_clearance_level', '?')}); actor clearance: "
                f"{details.get('actor_clearance_label', 'lower clearance')} "
                f"(Level {details.get('actor_clearance_level', '?')})."
            )
        elif count >= 5:
            score = 88
            classification = "POTENTIAL_UNAUTHORIZED_ACCESS"
            title = "Repeated role-based authorization denials"
            description = f"{count} role-based access denials were recorded for {actor} against {path or 'a protected endpoint'}."
        elif count >= 2:
            score = 62
            classification = "REPEATED_ACCESS_DENIAL"
            title = "Repeated role-based access denial"
            description = f"{count} access-denied events were recorded for {actor}. The pattern requires analyst review."
        else:
            score = 12
            classification = "ROUTINE_ACCESS_DENIAL"
            title = "Single role-based access denial"
            description = "A single role-based access denial was recorded. This may be a routine permission mismatch or user mistake."

        item = {
            "denial_type": "DATA_CLEARANCE" if is_clearance else "ROLE_BASED",
            "actor_user_id": user_id,
            "client_ip": client_ip,
            "path": path,
            "resource_id": resource_id,
            "resource_name": details.get("resource_name"),
            "attempt_count": count,
            "first_seen": min(entry.timestamp for entry in entries),
            "last_seen": latest.timestamp,
            "required_roles": details.get("required_roles", []),
            "actor_roles": details.get("actor_roles", []),
            "required_clearance_level": details.get("required_clearance_level"),
            "required_clearance_label": details.get("required_clearance_label"),
            "actor_clearance_level": details.get("actor_clearance_level"),
            "actor_clearance_label": details.get("actor_clearance_label"),
        }
        activity_rows.append(item)
        findings.append(_finding(
            finding_type="DATA_CLEARANCE" if is_clearance else "ACCESS_CONTROL",
            classification=classification,
            title=title,
            description=description,
            source_ip=client_ip,
            risk_score=score,
            evidence=item,
            detected_at=latest.timestamp,
        ))
    return activity_rows, findings


def build_anomaly_analysis(db: Session, window_minutes: int = 60):
    """Build an explainable, metadata-based Module 3 analysis snapshot."""
    now = utc_now()
    window_start = now - timedelta(minutes=window_minutes)
    baseline_start = window_start - timedelta(days=BASELINE_DAYS)

    behavior = _network_behavior(db, window_start, window_minutes)
    # New-IP detection compares against all retained packet history. Recurring-IP
    # baselines use the same bounded 30-day horizon as recurring-flow analysis.
    ip_rows = _ip_observations(db)
    pattern_ip_rows = _ip_observations(
        db, since=now - timedelta(days=PATTERN_LOOKBACK_DAYS)
    )
    ip_patterns = _ip_patterns(pattern_ip_rows)
    flow_patterns, provisional_flows = _flow_patterns(db, now)

    new_ips = []
    new_ip_findings = []
    for row in ip_rows:
        if row.first_seen and _as_utc(row.first_seen) >= window_start:
            scope = _safe_ip_scope(row.ip_address)
            item = {
                "ip_address": row.ip_address,
                "scope": scope,
                "first_seen": _as_utc(row.first_seen),
                "last_seen": _as_utc(row.last_seen),
                "observations_in_history": int(row.observations),
                "observed_bytes": int(row.observed_bytes or 0),
                "source_observations": int(row.source_observations or 0),
                "destination_observations": int(row.destination_observations or 0),
            }
            new_ips.append(item)
            score = 24 if scope == "PUBLIC" else 16
            new_ip_findings.append(_finding(
                finding_type="NEW_IP",
                classification="NEW_ENDPOINT_REQUIRES_REVIEW",
                title="Newly observed IP address",
                description=(
                    "This IP address appears for the first time in the locally retained packet history. "
                    "A first-seen address is not, by itself, evidence of an attack."
                ),
                source_ip=row.ip_address,
                risk_score=score,
                evidence=item,
                detected_at=row.first_seen,
            ))

    source_rows, baseline = _source_statistics(db, window_start, baseline_start)
    traffic_findings = []
    for row in source_rows:
        source = row.source_ip
        packet_count = int(row.packet_count)
        total_bytes = int(row.total_bytes or 0)
        unique_destinations = int(row.unique_destinations or 0)
        unique_ports = int(row.unique_destination_ports or 0)
        active_minutes = max(int(row.active_minutes or 0), 1)
        current_rate = packet_count / active_minutes
        baseline_item = baseline.get(source)
        baseline_rate = None
        if baseline_item and baseline_item["active_minutes"] >= 5:
            baseline_rate = baseline_item["packet_count"] / baseline_item["active_minutes"]

        evidence = {
            "packet_count": packet_count,
            "total_bytes": total_bytes,
            "unique_destination_ips": unique_destinations,
            "unique_destination_ports": unique_ports,
            "active_minutes": active_minutes,
            "current_packets_per_active_minute": round(current_rate, 2),
            "baseline_packets_per_active_minute": round(baseline_rate, 2) if baseline_rate is not None else None,
        }

        if unique_ports >= 15 and packet_count >= 30:
            traffic_findings.append(_finding(
                finding_type="PORT_SWEEP_PATTERN",
                classification="POTENTIAL_RECONNAISSANCE",
                title="Broad destination-port activity",
                description=(
                    f"Source {source} contacted {unique_ports} distinct destination ports "
                    f"with {packet_count} packets in the selected window. This may indicate "
                    "service discovery or scanning; validate against an approved scan."
                ),
                source_ip=source,
                risk_score=76,
                evidence=evidence,
            ))
        elif unique_destinations >= 20 and packet_count >= 40:
            traffic_findings.append(_finding(
                finding_type="HOST_FAN_OUT",
                classification="POTENTIAL_RECONNAISSANCE",
                title="High destination-host fan-out",
                description=(
                    f"Source {source} communicated with {unique_destinations} distinct destination IPs "
                    "in the selected window. This may be normal infrastructure activity or reconnaissance."
                ),
                source_ip=source,
                risk_score=68,
                evidence=evidence,
            ))
        elif (
            baseline_rate is not None
            and current_rate >= max(baseline_rate * 3, baseline_rate + 5)
            and packet_count >= 25
        ):
            traffic_findings.append(_finding(
                finding_type="TRAFFIC_SPIKE",
                classification="TRAFFIC_ANOMALY",
                title="Traffic rate above historical baseline",
                description=(
                    f"Source {source} averaged {current_rate:.2f} packets per active minute; "
                    f"its previous {BASELINE_DAYS}-day baseline was {baseline_rate:.2f}. "
                    "The increase is a heuristic deviation, not proof of a denial-of-service attack."
                ),
                source_ip=source,
                risk_score=64,
                evidence=evidence,
            ))

    access_rows, access_findings = _access_denial_findings(db, window_start)
    clearance_rows = [row for row in access_rows if row["denial_type"] == "DATA_CLEARANCE"]
    role_denial_rows = [row for row in access_rows if row["denial_type"] == "ROLE_BASED"]
    # Week 3 is intentionally explainable and rule/baseline-based. Dataset-driven
    # unsupervised model training and evaluation are held for Week 4.
    model_findings = []
    model_status = {
        "status": "WEEK_4_PENDING",
        "trained_at": None,
        "training_flows": 0,
        "algorithms": ["Isolation Forest", "Local Outlier Factor"],
        "message": "Model training and evaluation are scheduled for Week 4.",
    }

    classifications = new_ip_findings + traffic_findings + access_findings
    classifications.sort(
        key=lambda item: (item["risk_score"], item["detected_at"]),
        reverse=True,
    )

    summary_row = db.execute(
        select(
            func.count(NetworkPacket.id),
            func.coalesce(func.sum(NetworkPacket.packet_length), 0),
            func.count(distinct(NetworkPacket.source_ip)),
            func.count(distinct(NetworkPacket.destination_ip)),
        ).where(NetworkPacket.captured_at >= window_start)
    ).one()

    return {
        "generated_at": now,
        "window_minutes": window_minutes,
        "baseline_days": BASELINE_DAYS,
        "summary": {
            "packets_analyzed_in_window": int(summary_row[0]),
            "bytes_analyzed_in_window": int(summary_row[1] or 0),
            "unique_source_ips": int(summary_row[2] or 0),
            "unique_destination_ips": int(summary_row[3] or 0),
            "new_ip_count": len(new_ips),
            "access_denial_groups": len(role_denial_rows),
            "clearance_denial_groups": len(clearance_rows),
            "classified_findings": len(classifications),
        },
        "network_behavior": behavior,
        "suspicious_activity": {
            "new_ips": sorted(new_ips, key=lambda item: item["first_seen"], reverse=True)[:100],
            "access_denials": role_denial_rows,
            "clearance_denials": clearance_rows,
            "access_control_note": (
                "Role-based authorization and data-clearance checks are independent controls. "
                "Clearance denials are recorded in the audit log and included in anomaly classification."
            ),
        },
        "patterns": {
            "regular_ips": ip_patterns[:100],
            "regular_flows": flow_patterns[:200],
            "provisional_flows": provisional_flows[:50],
            "lookback_days": PATTERN_LOOKBACK_DAYS,
            "regularity_rule": "A pattern is considered recurrent when it appears on at least two active days or in at least two capture sessions.",
        },
        "classifications": classifications[:200],
        "model_status": model_status,
        "classification_method": {
            "name": "Week 3 explainable rule-based and historical-baseline analysis",
            "risk_scale": "0-100",
            "severity_bands": {
                "INFORMATIONAL": "0-14",
                "LOW": "15-39",
                "MEDIUM": "40-64",
                "HIGH": "65-84",
                "CRITICAL": "85-100",
            },
            "limitations": [
                "A newly observed IP is not automatically malicious.",
                "A traffic spike is not proof of DDoS.",
                "Role-based denials and data-clearance denials are authorization signals, not proof of data exfiltration.",
                "The current packet schema does not retain HTTP payloads or application request bodies.",
                "Machine-learning model training and evaluation are reserved for Week 4.",
            ],
        },
    }
