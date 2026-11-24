from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db.session import get_db
from app.api.deps import get_current_user, get_client_ip, log_audit
from app.models.user import User, UserRole
from app.models.audit import AuditAction, AuditStatus
from app.models.anomaly import (
    SuspiciousActivity,
    NetworkBehaviorMetric,
    RecognizedPattern,
    AnomalyClassification,
)
from app.schemas.anomaly import (
    SuspiciousActivityResponse,
    ReportSuspiciousRequest,
    ResolveSuspiciousRequest,
    NetworkBehaviorMetricItem,
    RecognizedPatternItem,
    AnomalyClassificationItem,
    AnomalyOverviewStats,
)

router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])

def format_bytes(bytes_count: int) -> str:
    if not bytes_count or bytes_count == 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(bytes_count) < 1024.0:
            return f"{bytes_count:3.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} PB"

def ensure_initial_anomalies(db: Session):
    """Seed comprehensive initial data across all 4 Module 3 components if not present."""
    # 1. Suspicious Activities
    if db.query(SuspiciousActivity).count() == 0:
        activities = [
            SuspiciousActivity(
                activity_type="NEW_UNRECOGNIZED_IP",
                source_ip="198.51.100.44",
                destination_ip="10.0.0.5",
                user_identity="unregistered_ext_client",
                attempted_resource="Direct PostgreSQL TCP Port 5432",
                required_clearance="Restricted Core Subnet",
                actual_clearance="None / Unregistered External IP",
                severity="Critical",
                status="DETECTED",
                description="Unrecognized external public IP attempted direct TCP syn connection into internal database cluster.",
                technical_details="Flags=[SYN], Window=1024, Sequence=0x9f31a2, PayloadLength=60, Signature=ExternalDirectDBScan",
            ),
            SuspiciousActivity(
                activity_type="UNAUTHORIZED_CLEARANCE_ACCESS",
                source_ip="192.168.1.140",
                destination_ip="10.0.0.2",
                user_identity="analyst_alex",
                attempted_resource="/api/v1/audit/export-all-keys",
                required_clearance="Administrator (Tier 3 Clearance)",
                actual_clearance="Security Analyst (Tier 1 Clearance)",
                severity="High",
                status="DETECTED",
                description="Active Analyst role attempted to query restricted cryptographic export endpoint above authorized security tier.",
                technical_details="Method=POST, Endpoint=/api/v1/audit/export-all-keys, RoleEnforced=ADMIN, UserRole=ANALYST, AuthOutcome=403_FORBIDDEN",
            ),
            SuspiciousActivity(
                activity_type="NEW_UNRECOGNIZED_IP",
                source_ip="192.168.1.189",
                destination_ip="10.0.0.12",
                user_identity="rogue_host_unknown_dhcp",
                attempted_resource="SSH Daemon TCP Port 22",
                required_clearance="Management VLAN Only",
                actual_clearance="Guest VLAN / Untrusted Host",
                severity="High",
                status="REPORTED_TO_LEAD",
                description="Unbaselined local MAC address requesting lateral SSH authentication bursts against secondary app server.",
                technical_details="Bursts=18 attempts/sec, Protocol=SSH-2.0-OpenSSH_8.9p1, Flags=[PSH,ACK], Fingerprint=UnknownDeviceType",
                analyst_notes="Identified this new rogue device on engineering floor subnet. It is cycling standard credentials. Escalating to Sarah for quarantine.",
                reported_at=datetime.now(timezone.utc),
            ),
            SuspiciousActivity(
                activity_type="UNAUTHORIZED_CLEARANCE_ACCESS",
                source_ip="192.168.1.75",
                destination_ip="10.0.0.8",
                user_identity="contractor_dev",
                attempted_resource="/api/v1/users/financial-records",
                required_clearance="Executive Clearance / Admin",
                actual_clearance="Contractor Clearance (Tier 0)",
                severity="Medium",
                status="DETECTED",
                description="Contractor credentials attempted to invoke confidential payroll & financial data API routes.",
                technical_details="ClientAgent=PostmanRuntime/7.36.0, Path=/api/v1/users/financial-records, TokenState=ACTIVE, PermissionDenied=TRUE",
            ),
            SuspiciousActivity(
                activity_type="NEW_UNRECOGNIZED_IP",
                source_ip="203.0.113.88",
                destination_ip="10.0.0.1",
                user_identity="unregistered_vps_scanner",
                attempted_resource="Recursive DNS Amplification UDP Port 53",
                required_clearance="Authoritative Zone Only",
                actual_clearance="External Non-Authoritative",
                severity="Low",
                status="ACTION_TAKEN",
                description="Hostile VPS probe executing open recursive DNS query sequences against gateway resolver.",
                technical_details="Query=ANY isc.org, EDNS0_BufSize=4096, ResponseAmplificationRatio=1:54, Protocol=DNS_UDP",
                resolution_action="BLOCKED_IP",
                resolution_notes="Ingress IP blocked at edge border router ACL. Zero internal impact.",
                resolved_at=datetime.now(timezone.utc),
            ),
        ]
        db.bulk_save_objects(activities)
        db.commit()

    # 2. Network Behavior Metrics (Tabular format, high technical density)
    if db.query(NetworkBehaviorMetric).count() == 0:
        metrics = [
            NetworkBehaviorMetric(
                metric_name="Packet Inter-Arrival Time (IAT)",
                protocol_layer="Transport Layer (L4)",
                baseline_mean=18.5,
                baseline_stddev=3.2,
                observed_value=0.8,
                unit="ms",
                z_score=-5.53,
                volatility="High Spike",
                status="THRESHOLD_EXCEEDED",
                technical_diagnosis="Severe inter-arrival time compression (<1ms) indicative of algorithmic packet flood or scripted micro-bursts.",
            ),
            NetworkBehaviorMetric(
                metric_name="TCP SYN-to-ACK Asymmetry",
                protocol_layer="Transport Layer (L4)",
                baseline_mean=1.05,
                baseline_stddev=0.08,
                observed_value=14.80,
                unit="ratio",
                z_score=171.88,
                volatility="High Spike",
                status="THRESHOLD_EXCEEDED",
                technical_diagnosis="Extreme SYN asymmetry ratio with 93.2% unacknowledged half-open TCP handshakes (SYN flood volumetric anomaly).",
            ),
            NetworkBehaviorMetric(
                metric_name="Shannon Port Entropy",
                protocol_layer="Transport Layer (L4)",
                baseline_mean=1.45,
                baseline_stddev=0.22,
                observed_value=4.88,
                unit="bits",
                z_score=15.59,
                volatility="High Spike",
                status="THRESHOLD_EXCEEDED",
                technical_diagnosis="High port entropy distribution characteristic of systematic horizontal and vertical port scanning sequences.",
            ),
            NetworkBehaviorMetric(
                metric_name="Flow Connection Jitter",
                protocol_layer="Network Layer (L3)",
                baseline_mean=4.20,
                baseline_stddev=1.10,
                observed_value=6.80,
                unit="ms",
                z_score=2.36,
                volatility="Moderate",
                status="VARIANCE_DRIFT",
                technical_diagnosis="Moderate connection latency jitter on perimeter gateway router interface, exceeding 2-sigma variance threshold.",
            ),
            NetworkBehaviorMetric(
                metric_name="Payload Byte Variance",
                protocol_layer="Application Layer (L7)",
                baseline_mean=480.0,
                baseline_stddev=65.0,
                observed_value=1460.0,
                unit="bytes",
                z_score=15.08,
                volatility="High Spike",
                status="DEVIATION_WARNING",
                technical_diagnosis="Consistently saturated MTU payloads (1460 B) deviating from nominal mixed HTTP/DNS payload distribution.",
            ),
            NetworkBehaviorMetric(
                metric_name="DNS Query Burst Frequency",
                protocol_layer="Application Layer (L7)",
                baseline_mean=12.0,
                baseline_stddev=2.5,
                observed_value=118.0,
                unit="req/s",
                z_score=42.40,
                volatility="High Spike",
                status="THRESHOLD_EXCEEDED",
                technical_diagnosis="Frequency spike in unique DNS lookup transactions, matching fast-flux C2 domain generation algorithm (DGA).",
            ),
            NetworkBehaviorMetric(
                metric_name="TLS Handshake Resumption Rate",
                protocol_layer="Cryptographic Session (L5)",
                baseline_mean=94.0,
                baseline_stddev=2.0,
                observed_value=92.5,
                unit="%",
                z_score=-0.75,
                volatility="Stable",
                status="NOMINAL",
                technical_diagnosis="Cryptographic session resumption and TLS 1.3 ticket negotiation nominal across core application servers.",
            ),
            NetworkBehaviorMetric(
                metric_name="TCP Window Size Scaling",
                protocol_layer="Transport Layer (L4)",
                baseline_mean=65535.0,
                baseline_stddev=4096.0,
                observed_value=64200.0,
                unit="bytes",
                z_score=-0.33,
                volatility="Stable",
                status="NOMINAL",
                technical_diagnosis="Socket buffer receive window advertisement conforms to RFC 7323 baseline specifications.",
            ),
        ]
        db.bulk_save_objects(metrics)
        db.commit()

    # 3. Recognized Patterns (Regular packet transfers & regularly used IP addresses)
    if db.query(RecognizedPattern).count() == 0:
        patterns = [
            # Regularly used IP addresses (Whitelist Catalog)
            RecognizedPattern(
                pattern_type="REGULAR_IP",
                name="Primary Default Gateway / Router",
                source_ip="10.0.0.1",
                destination_ip="Any Internal / Perimeter",
                protocol="ICMP/IP",
                port=None,
                frequency="Continuous Routing Transit",
                expected_packet_range="64 - 1500 B",
                avg_transfer_bytes=485000000,
                confidence_score=99.9,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="REGULAR_IP",
                name="Cloudflare Anycast DNS Resolver",
                source_ip="Any Local Subnet",
                destination_ip="1.1.1.1",
                protocol="DNS (UDP/TCP)",
                port=53,
                frequency="On-Demand Name Lookups (~12 req/s)",
                expected_packet_range="60 - 512 B",
                avg_transfer_bytes=12400000,
                confidence_score=99.8,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="REGULAR_IP",
                name="Google Secondary Public DNS",
                source_ip="Any Local Subnet",
                destination_ip="8.8.8.8",
                protocol="DNS (UDP/TCP)",
                port=53,
                frequency="Fallback Resolver (~2 req/s)",
                expected_packet_range="60 - 512 B",
                avg_transfer_bytes=4200000,
                confidence_score=99.8,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="REGULAR_IP",
                name="Internal Enterprise PostgreSQL Database",
                source_ip="192.168.1.10 - 192.168.1.50",
                destination_ip="10.0.0.5",
                protocol="PostgreSQL TCP",
                port=5432,
                frequency="Persistent Pooled Connections",
                expected_packet_range="128 - 4096 B",
                avg_transfer_bytes=89200000,
                confidence_score=99.9,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="REGULAR_IP",
                name="Corporate Active Directory & LDAP Controller",
                source_ip="192.168.1.0/24 Subnet",
                destination_ip="192.168.1.100",
                protocol="LDAP / Kerberos",
                port=389,
                frequency="User Authentication & Group Sync",
                expected_packet_range="256 - 2048 B",
                avg_transfer_bytes=34500000,
                confidence_score=99.9,
                is_whitelisted=True,
            ),
            # Regular Packet Transfers & Scheduled Workloads
            RecognizedPattern(
                pattern_type="SCHEDULED_TRANSFER",
                name="NTP Network Time Protocol Synchronization",
                source_ip="10.0.0.1",
                destination_ip="pool.ntp.org (External)",
                protocol="NTP (UDP)",
                port=123,
                frequency="Periodic Heartbeat (Every 64 seconds)",
                expected_packet_range="48 Bytes Fixed",
                avg_transfer_bytes=98000,
                confidence_score=99.7,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="SCHEDULED_TRANSFER",
                name="Database Write-Ahead Log (WAL) Streaming",
                source_ip="10.0.0.5 (Primary DB)",
                destination_ip="10.0.0.6 (Replica Standby)",
                protocol="TCP Stream",
                port=5432,
                frequency="Real-time Stream (~250ms batch cadence)",
                expected_packet_range="512 - 1460 B",
                avg_transfer_bytes=145000000,
                confidence_score=99.9,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="SCHEDULED_TRANSFER",
                name="Kubernetes Ingress Health Check Liveness Probe",
                source_ip="10.0.0.2 (Load Balancer)",
                destination_ip="10.0.0.10 - 10.0.0.15 (Pods)",
                protocol="HTTP (GET /healthz)",
                port=8080,
                frequency="High-frequency Ping (Every 5 seconds)",
                expected_packet_range="112 - 196 B",
                avg_transfer_bytes=1840000,
                confidence_score=99.9,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="SCHEDULED_TRANSFER",
                name="Nightly Offsite Encrypted Backup Synchronization",
                source_ip="10.0.0.5 (DB Master)",
                destination_ip="10.0.0.25 (Cold Vault Archive)",
                protocol="TLS / rsync over SSH",
                port=2222,
                frequency="Scheduled Batch (Daily at 02:00 UTC)",
                expected_packet_range="1400 - 1500 B (Jumbo MTU)",
                avg_transfer_bytes=2400000000,
                confidence_score=99.6,
                is_whitelisted=True,
            ),
            RecognizedPattern(
                pattern_type="SCHEDULED_TRANSFER",
                name="Prometheus Telemetry Metrics Scrape Sequence",
                source_ip="10.0.0.3 (Prometheus)",
                destination_ip="Internal Server Fleet (:9100)",
                protocol="HTTP /metrics",
                port=9100,
                frequency="Periodic Scrape (Every 15 seconds)",
                expected_packet_range="256 - 4096 B",
                avg_transfer_bytes=15600000,
                confidence_score=99.8,
                is_whitelisted=True,
            ),
        ]
        db.bulk_save_objects(patterns)
        db.commit()

    # 4. Anomaly Classifications (Assessing whether dangerous attacks vs simple operational mistakes)
    if db.query(AnomalyClassification).count() == 0:
        classifications = [
            # Dangerous Attacks
            AnomalyClassification(
                threat_signature="TCP SYN Flood Volumetric Denial of Service",
                risk_level="CRITICAL",
                classification_type="DANGEROUS_ATTACK",
                is_mistake=False,
                target_asset="10.0.0.5 (Core Enterprise Database)",
                vector_identifier="MITRE ATT&CK T1498.001 (Direct Network Flood)",
                confidence_pct=98.6,
                root_cause_explanation="Hostile actor transmitting thousands of unacknowledged SYN packets from forged spoofed IPs to consume server half-open socket tables and cause service denial.",
                recommended_remediation="Activate kernel SYN cookies (sysctl net.ipv4.tcp_syncookies=1), enforce upstream rate limiting on edge firewall, drop untrusted SYN bursts.",
            ),
            AnomalyClassification(
                threat_signature="Unauthorized Privilege Escalation & Clearance Breach Attempt",
                risk_level="CRITICAL",
                classification_type="DANGEROUS_ATTACK",
                is_mistake=False,
                target_asset="/api/v1/audit/export-all-keys (Vault Cryptographic Keyring)",
                vector_identifier="MITRE ATT&CK T1078.002 (Domain Accounts)",
                confidence_pct=96.4,
                root_cause_explanation="Malicious or compromised low-privilege analyst credential actively executing vertical privilege escalation attempts against administrative secrets endpoints.",
                recommended_remediation="Immediately revoke active session bearer token in blocklist, isolate client IP 192.168.1.140, require supervisor identity verification.",
            ),
            AnomalyClassification(
                threat_signature="C2 Fast-Flux DNS Beaconing & DGA Query Sequence",
                risk_level="HIGH",
                classification_type="DANGEROUS_ATTACK",
                is_mistake=False,
                target_asset="External Perimeter Resolver (1.1.1.1:53)",
                vector_identifier="MITRE ATT&CK T1071.004 (DNS Communication Channel)",
                confidence_pct=94.8,
                root_cause_explanation="Compromised endpoint generating high-frequency pseudo-random domain queries with short TTLs (30s) to establish persistent Command and Control command channels.",
                recommended_remediation="Quarantine infected host workstation, sinkhole identified malicious domain hashes on enterprise resolver, trigger host EDR scan.",
            ),
            # Operational Mistakes / Misconfigurations (NOT Attacks)
            AnomalyClassification(
                threat_signature="Expired Internal Service TLS Certificate Handshake Failure",
                risk_level="LOW",
                classification_type="OPERATIONAL_MISTAKE",
                is_mistake=True,
                target_asset="10.0.0.14 (Internal Metrics Collector Daemon)",
                vector_identifier="RFC 5280 PKI Certificate Expiration",
                confidence_pct=99.2,
                root_cause_explanation="Harmless operational mistake: The internal service X.509 certificate expired 6 hours ago; clients connecting receive SSL_ERROR_EXPIRED. Zero malicious adversarial intent.",
                recommended_remediation="Renew internal TLS certificate using enterprise CA / automated Certbot, reload reverse proxy daemon. No security quarantine required.",
            ),
            AnomalyClassification(
                threat_signature="Subnet IP Address Collision (Duplicate Static Assignment)",
                risk_level="MEDIUM",
                classification_type="OPERATIONAL_MISTAKE",
                is_mistake=True,
                target_asset="192.168.1.105 (Staging Server Network Card)",
                vector_identifier="RFC 826 ARP Protocol Conflict",
                confidence_pct=97.5,
                root_cause_explanation="Simple IT configuration error: Systems administrator assigned static IP 192.168.1.105 while the DHCP scope had already dynamically assigned it to an engineering workstation, causing periodic MAC flap alerts.",
                recommended_remediation="Update static allocation range or reconfigure staging server to use DHCP reservations outside the dynamic pool.",
            ),
            AnomalyClassification(
                threat_signature="Developer Port Typo in Connection String (RST/ACK Drift)",
                risk_level="LOW",
                classification_type="OPERATIONAL_MISTAKE",
                is_mistake=True,
                target_asset="10.0.0.5:5433 (PostgreSQL Port Misconfiguration)",
                vector_identifier="TCP Connection Refused (RST Sequence)",
                confidence_pct=98.9,
                root_cause_explanation="Harmless developer typo: Newly deployed microservice had connection string pointing to port 5433 instead of 5432, receiving instant RST packets. Pure human error.",
                recommended_remediation="Correct PORT parameter in service deployment environment variables from 5433 to 5432 and redeploy container.",
            ),
        ]
        db.bulk_save_objects(classifications)
        db.commit()

# ==============================================================================
# API Endpoints
# ==============================================================================

@router.get("/overview", response_model=AnomalyOverviewStats)
def get_anomaly_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns high-level KPI counts for the Anomaly Detection Module."""
    ensure_initial_anomalies(db)

    total_anomalies = db.query(AnomalyClassification).count()
    critical_threats = db.query(AnomalyClassification).filter(AnomalyClassification.risk_level == "CRITICAL").count()
    suspicious_pending = db.query(SuspiciousActivity).filter(SuspiciousActivity.status.in_(["DETECTED", "REPORTED_TO_LEAD"])).count()
    mistakes_identified = db.query(AnomalyClassification).filter(AnomalyClassification.is_mistake == True).count()
    patterns_count = db.query(RecognizedPattern).count()
    behavior_anomalies = db.query(NetworkBehaviorMetric).filter(NetworkBehaviorMetric.status.in_(["DEVIATION_WARNING", "THRESHOLD_EXCEEDED"])).count()

    return AnomalyOverviewStats(
        total_anomalies=total_anomalies,
        critical_threats=critical_threats,
        suspicious_pending_review=suspicious_pending,
        mistakes_identified=mistakes_identified,
        regular_patterns_count=patterns_count,
        behavior_anomalies_count=behavior_anomalies,
    )

@router.get("/behavior", response_model=list[NetworkBehaviorMetricItem])
def get_network_behavior_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sub-section 1: Network Behavior Analysis.
    Returns high-density tabular behavioral telemetry with exact technical terms:
    Inter-Arrival Time, TCP SYN/ACK Asymmetry, Shannon Entropy, Flow Jitter, Z-score, Volatility.
    """
    ensure_initial_anomalies(db)
    metrics = db.query(NetworkBehaviorMetric).order_by(desc(func.abs(NetworkBehaviorMetric.z_score))).all()
    return metrics

@router.get("/suspicious", response_model=list[SuspiciousActivityResponse])
def get_suspicious_activities(
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sub-section 2: Suspicious Activity Detection.
    Detects new unrecognized IPs and unauthorized users attempting to access data above clearance.
    """
    ensure_initial_anomalies(db)
    query = db.query(SuspiciousActivity)
    if status_filter and status_filter != "ALL":
        query = query.filter(SuspiciousActivity.status == status_filter)
    if severity and severity != "ALL":
        query = query.filter(SuspiciousActivity.severity == severity)

    activities = query.order_by(desc(SuspiciousActivity.created_at)).all()

    # Enrich with reporter and resolver usernames
    res = []
    for a in activities:
        item = SuspiciousActivityResponse(
            id=a.id,
            activity_type=a.activity_type,
            source_ip=a.source_ip,
            destination_ip=a.destination_ip,
            user_identity=a.user_identity,
            attempted_resource=a.attempted_resource,
            required_clearance=a.required_clearance,
            actual_clearance=a.actual_clearance,
            severity=a.severity,
            status=a.status,
            description=a.description,
            technical_details=a.technical_details,
            reported_by_id=a.reported_by_id,
            reported_by_name=a.reporter.full_name if a.reporter else (a.reporter.username if a.reporter else None),
            reported_at=a.reported_at,
            analyst_notes=a.analyst_notes,
            resolved_by_id=a.resolved_by_id,
            resolved_by_name=a.resolver.full_name if a.resolver else (a.resolver.username if a.resolver else None),
            resolved_at=a.resolved_at,
            resolution_action=a.resolution_action,
            resolution_notes=a.resolution_notes,
            created_at=a.created_at,
        )
        res.append(item)
    return res

@router.post("/suspicious/{activity_id}/report", response_model=SuspiciousActivityResponse)
def report_suspicious_to_lead(
    activity_id: int,
    payload: ReportSuspiciousRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyst workflow: Report detected suspicious activity to Team Lead with technical notes.
    """
    activity = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suspicious activity record not found.")

    activity.status = "REPORTED_TO_LEAD"
    activity.reported_by_id = current_user.id
    activity.reported_at = datetime.now(timezone.utc)
    activity.analyst_notes = payload.analyst_notes

    db.commit()
    db.refresh(activity)

    # Log audit trail
    log_audit(
        db=db,
        action=AuditAction.SECURITY_ALERT,
        target_type="SUSPICIOUS_ACTIVITY",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(activity.id),
        details={
            "action": "REPORTED_TO_TEAM_LEAD",
            "activity_type": activity.activity_type,
            "source_ip": activity.source_ip,
            "analyst_notes": payload.analyst_notes,
        },
        ip_address=get_client_ip(request),
    )

    return SuspiciousActivityResponse(
        id=activity.id,
        activity_type=activity.activity_type,
        source_ip=activity.source_ip,
        destination_ip=activity.destination_ip,
        user_identity=activity.user_identity,
        attempted_resource=activity.attempted_resource,
        required_clearance=activity.required_clearance,
        actual_clearance=activity.actual_clearance,
        severity=activity.severity,
        status=activity.status,
        description=activity.description,
        technical_details=activity.technical_details,
        reported_by_id=activity.reported_by_id,
        reported_by_name=current_user.full_name or current_user.username,
        reported_at=activity.reported_at,
        analyst_notes=activity.analyst_notes,
        resolved_by_id=activity.resolved_by_id,
        resolved_by_name=activity.resolver.full_name if activity.resolver else None,
        resolved_at=activity.resolved_at,
        resolution_action=activity.resolution_action,
        resolution_notes=activity.resolution_notes,
        created_at=activity.created_at,
    )

@router.post("/suspicious/{activity_id}/resolve", response_model=SuspiciousActivityResponse)
def resolve_suspicious_activity(
    activity_id: int,
    payload: ResolveSuspiciousRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Team Lead workflow: Team Lead / Admin takes action (Block IP, Quarantine Host, Revoke Token)
    or dismisses the alert (False Positive, Authorized Exception).
    Strict RBAC: Security Analysts are forbidden from resolving.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.TEAM_LEAD]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RBAC Restriction: Only Team Leads and Administrators have authority to resolve or dismiss suspicious activity alerts."
        )

    activity = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suspicious activity record not found.")

    action_upper = payload.action.upper()
    if "DISMISS" in action_upper:
        activity.status = "DISMISSED"
    else:
        activity.status = "ACTION_TAKEN"

    activity.resolved_by_id = current_user.id
    activity.resolved_at = datetime.now(timezone.utc)
    activity.resolution_action = action_upper
    activity.resolution_notes = payload.resolution_notes or f"Action {action_upper} executed by Team Lead {current_user.username}."

    db.commit()
    db.refresh(activity)

    # Log audit event
    log_audit(
        db=db,
        action=AuditAction.SECURITY_ALERT,
        target_type="SUSPICIOUS_ACTIVITY",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(activity.id),
        details={
            "resolution_action": activity.resolution_action,
            "resolution_notes": activity.resolution_notes,
            "resolved_status": activity.status,
            "source_ip": activity.source_ip,
        },
        ip_address=get_client_ip(request),
    )

    return SuspiciousActivityResponse(
        id=activity.id,
        activity_type=activity.activity_type,
        source_ip=activity.source_ip,
        destination_ip=activity.destination_ip,
        user_identity=activity.user_identity,
        attempted_resource=activity.attempted_resource,
        required_clearance=activity.required_clearance,
        actual_clearance=activity.actual_clearance,
        severity=activity.severity,
        status=activity.status,
        description=activity.description,
        technical_details=activity.technical_details,
        reported_by_id=activity.reported_by_id,
        reported_by_name=activity.reporter.full_name if activity.reporter else None,
        reported_at=activity.reported_at,
        analyst_notes=activity.analyst_notes,
        resolved_by_id=activity.resolved_by_id,
        resolved_by_name=current_user.full_name or current_user.username,
        resolved_at=activity.resolved_at,
        resolution_action=activity.resolution_action,
        resolution_notes=activity.resolution_notes,
        created_at=activity.created_at,
    )

@router.get("/patterns", response_model=list[RecognizedPatternItem])
def get_recognized_patterns(
    pattern_type: str | None = Query(None), # REGULAR_IP, SCHEDULED_TRANSFER
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sub-section 3: Pattern Recognition.
    Lists regular packet transfers and regularly used IP addresses (whitelist catalog).
    """
    ensure_initial_anomalies(db)
    query = db.query(RecognizedPattern)
    if pattern_type and pattern_type != "ALL":
        query = query.filter(RecognizedPattern.pattern_type == pattern_type)

    patterns = query.order_by(desc(RecognizedPattern.confidence_score)).all()

    items = []
    for p in patterns:
        item = RecognizedPatternItem(
            id=p.id,
            pattern_type=p.pattern_type,
            name=p.name,
            source_ip=p.source_ip,
            destination_ip=p.destination_ip,
            protocol=p.protocol,
            port=p.port,
            frequency=p.frequency,
            expected_packet_range=p.expected_packet_range,
            avg_transfer_bytes=p.avg_transfer_bytes,
            formatted_bytes=format_bytes(p.avg_transfer_bytes),
            confidence_score=p.confidence_score,
            is_whitelisted=p.is_whitelisted,
            last_seen=p.last_seen,
        )
        items.append(item)
    return items

@router.get("/classifications", response_model=list[AnomalyClassificationItem])
def get_anomaly_classifications(
    risk_level: str | None = Query(None),
    is_mistake: bool | None = Query(None),
    classification_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sub-section 4: Anomaly Classification.
    Assesses whether an anomaly is dangerous (Active Attacks) or simply an operational mistake / misconfiguration.
    """
    ensure_initial_anomalies(db)
    query = db.query(AnomalyClassification)
    if risk_level and risk_level != "ALL":
        query = query.filter(AnomalyClassification.risk_level == risk_level)
    if is_mistake is not None:
        query = query.filter(AnomalyClassification.is_mistake == is_mistake)
    if classification_type and classification_type != "ALL":
        query = query.filter(AnomalyClassification.classification_type == classification_type)

    classifications = query.order_by(desc(AnomalyClassification.detected_at)).all()
    return classifications
