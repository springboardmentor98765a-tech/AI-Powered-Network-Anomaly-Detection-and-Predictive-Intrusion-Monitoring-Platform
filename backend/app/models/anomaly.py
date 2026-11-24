from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, Float, Boolean, String, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class SuspiciousActivity(Base):
    __tablename__ = "suspicious_activities"

    id = Column(Integer, primary_key=True, index=True)
    activity_type = Column(String(50), nullable=False, index=True) # NEW_UNRECOGNIZED_IP, UNAUTHORIZED_CLEARANCE_ACCESS, etc.
    source_ip = Column(String(45), nullable=False, index=True)
    destination_ip = Column(String(45), nullable=False, index=True)
    user_identity = Column(String(100), nullable=False, index=True)
    attempted_resource = Column(String(255), nullable=False)
    required_clearance = Column(String(50), nullable=False)
    actual_clearance = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False, default="High") # Critical, High, Medium, Low
    status = Column(String(30), nullable=False, default="DETECTED", index=True) # DETECTED, REPORTED_TO_LEAD, ACTION_TAKEN, DISMISSED
    description = Column(String(500), nullable=False)
    technical_details = Column(Text, nullable=True)

    # Workflow: Analyst reports to Team Lead
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reported_at = Column(DateTime, nullable=True)
    analyst_notes = Column(Text, nullable=True)

    # Workflow: Team Lead resolves (Take Action or Dismiss)
    resolved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_action = Column(String(50), nullable=True) # BLOCKED_IP, QUARANTINED_HOST, REVOKED_TOKEN, DISMISSED_FALSE_POSITIVE, DISMISSED_AUTHORIZED
    resolution_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    reporter = relationship("User", foreign_keys=[reported_by_id])
    resolver = relationship("User", foreign_keys=[resolved_by_id])

class NetworkBehaviorMetric(Base):
    __tablename__ = "network_behavior_metrics"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), nullable=False)
    protocol_layer = Column(String(50), nullable=False)
    baseline_mean = Column(Float, nullable=False)
    baseline_stddev = Column(Float, nullable=False)
    observed_value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    z_score = Column(Float, nullable=False)
    volatility = Column(String(20), nullable=False, default="Stable")
    status = Column(String(30), nullable=False, default="NOMINAL") # NOMINAL, VARIANCE_DRIFT, DEVIATION_WARNING, THRESHOLD_EXCEEDED
    technical_diagnosis = Column(String(500), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class RecognizedPattern(Base):
    __tablename__ = "recognized_patterns"

    id = Column(Integer, primary_key=True, index=True)
    pattern_type = Column(String(50), nullable=False, index=True) # REGULAR_IP, SCHEDULED_TRANSFER
    name = Column(String(100), nullable=False)
    source_ip = Column(String(45), nullable=False, index=True)
    destination_ip = Column(String(45), nullable=False, index=True)
    protocol = Column(String(20), nullable=False)
    port = Column(Integer, nullable=True)
    frequency = Column(String(100), nullable=False)
    expected_packet_range = Column(String(50), nullable=False)
    avg_transfer_bytes = Column(BigInteger, nullable=False, default=0)
    confidence_score = Column(Float, nullable=False, default=99.0)
    is_whitelisted = Column(Boolean, default=True, nullable=False)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class AnomalyClassification(Base):
    __tablename__ = "anomaly_classifications"

    id = Column(Integer, primary_key=True, index=True)
    threat_signature = Column(String(150), nullable=False)
    risk_level = Column(String(20), nullable=False, index=True) # CRITICAL, HIGH, MEDIUM, LOW
    classification_type = Column(String(30), nullable=False, index=True) # DANGEROUS_ATTACK, OPERATIONAL_MISTAKE, BENIGN_DEVIATION
    is_mistake = Column(Boolean, default=False, nullable=False)
    target_asset = Column(String(100), nullable=False)
    vector_identifier = Column(String(100), nullable=False)
    confidence_pct = Column(Float, nullable=False)
    root_cause_explanation = Column(Text, nullable=False)
    recommended_remediation = Column(Text, nullable=False)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
