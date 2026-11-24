from datetime import datetime
from pydantic import BaseModel, Field

class SuspiciousActivityResponse(BaseModel):
    id: int
    activity_type: str
    source_ip: str
    destination_ip: str
    user_identity: str
    attempted_resource: str
    required_clearance: str
    actual_clearance: str
    severity: str
    status: str
    description: str
    technical_details: str | None = None
    reported_by_id: int | None = None
    reported_by_name: str | None = None
    reported_at: datetime | None = None
    analyst_notes: str | None = None
    resolved_by_id: int | None = None
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    resolution_action: str | None = None
    resolution_notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReportSuspiciousRequest(BaseModel):
    analyst_notes: str = Field(..., min_length=3, max_length=500)

class ResolveSuspiciousRequest(BaseModel):
    action: str = Field(..., min_length=3, max_length=50) # BLOCKED_IP, QUARANTINED_HOST, REVOKED_TOKEN, DISMISSED_FALSE_POSITIVE, DISMISSED_AUTHORIZED
    resolution_notes: str | None = Field(None, max_length=500)

class NetworkBehaviorMetricItem(BaseModel):
    id: int
    metric_name: str
    protocol_layer: str
    baseline_mean: float
    baseline_stddev: float
    observed_value: float
    unit: str
    z_score: float
    volatility: str
    status: str
    technical_diagnosis: str
    updated_at: datetime

    class Config:
        from_attributes = True

class RecognizedPatternItem(BaseModel):
    id: int
    pattern_type: str
    name: str
    source_ip: str
    destination_ip: str
    protocol: str
    port: int | None = None
    frequency: str
    expected_packet_range: str
    avg_transfer_bytes: int
    formatted_bytes: str | None = None
    confidence_score: float
    is_whitelisted: bool
    last_seen: datetime

    class Config:
        from_attributes = True

class AnomalyClassificationItem(BaseModel):
    id: int
    threat_signature: str
    risk_level: str
    classification_type: str
    is_mistake: bool
    target_asset: str
    vector_identifier: str
    confidence_pct: float
    root_cause_explanation: str
    recommended_remediation: str
    detected_at: datetime

    class Config:
        from_attributes = True

class AnomalyOverviewStats(BaseModel):
    total_anomalies: int
    critical_threats: int
    suspicious_pending_review: int
    mistakes_identified: int
    regular_patterns_count: int
    behavior_anomalies_count: int
