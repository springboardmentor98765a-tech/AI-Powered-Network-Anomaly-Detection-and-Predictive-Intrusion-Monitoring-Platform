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

class CreateSuspiciousActivityRequest(BaseModel):
    activity_type: str = Field(..., max_length=50) # NEW_UNRECOGNIZED_IP, CLEARANCE_VIOLATION
    source_ip: str = Field(..., min_length=3, max_length=45)
    destination_ip: str = Field("10.0.0.1", max_length=45)
    user_identity: str = Field("unauthenticated_client", max_length=100)
    attempted_resource: str = Field(..., min_length=2, max_length=200)
    required_clearance: str = Field("Standard Clearance (Tier 1)", max_length=100)
    actual_clearance: str = Field("Unassigned (Tier 0)", max_length=100)
    severity: str = Field("Medium", max_length=20) # Critical, High, Medium, Low
    description: str = Field(..., min_length=5, max_length=500)
    analyst_notes: str | None = Field(None, max_length=500)

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
