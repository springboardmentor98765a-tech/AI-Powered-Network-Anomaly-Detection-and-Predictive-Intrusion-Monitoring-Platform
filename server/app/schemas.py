from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_name: str = "Analyst"

# --- Role & User Schemas ---
class RoleResponse(BaseModel):
    id: int
    role_name: str
    description: str | None = None

    class Config:
        orm_mode = True

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_names: list[str] = ["Security Analyst"]

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    status: str
    created_at: datetime
    roles: list[RoleResponse] = []

    class Config:
        orm_mode = True

class UserStatusUpdate(BaseModel):
    status: str  # 'active' or 'inactive'

class RoleAssignRequest(BaseModel):
    role_name: str

# --- Team Schemas ---
class TeamCreate(BaseModel):
    team_name: str
    description: str | None = None

class TeamMemberAdd(BaseModel):
    user_id: int

class TeamResponse(BaseModel):
    id: int
    team_name: str
    description: str | None = None
    created_at: datetime
    members: list[UserResponse] = []

    class Config:
        orm_mode = True

class NetworkFlowCreate(BaseModel):
    source_ip: str
    destination_ip: str
    source_port: int = 0
    destination_port: int = 0
    protocol: str
    packet_length: int
    flow_duration: float = 0.0
    flag: Optional[str] = None
    status: Optional[str] = "NORMAL"


class NetworkFlowResponse(NetworkFlowCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class ProtocolStat(BaseModel):
    protocol: str
    count: int
    total_bytes: int


class HostStat(BaseModel):
    ip: str
    packet_count: int
    total_bytes: int


class DirectionStat(BaseModel):
    direction: str
    count: int
    total_bytes: int


class TimeSeriesPoint(BaseModel):
    time_bucket: str
    packet_count: int
    total_bytes: int


class TrafficSummary(BaseModel):
    total_flows: int
    total_bytes: int
    suspicious_count: int
    protocols: list[ProtocolStat]
    top_sources: list[HostStat]
    top_destinations: list[HostStat]
    directions: list[DirectionStat]
    activity_over_time: list[TimeSeriesPoint]

class BehaviorRow(BaseModel):
    id: int
    source_ip: str
    destination_ip: str
    protocol: str
    destination_port: int
    packet_count: int
    total_bytes: int
    avg_packet_size: float
    flow_rate_pps: float
    syn_ratio: float
    behavioral_profile: str
    detection_trigger: str
    is_new_ip: bool
    unauthorized_clearance: bool
    risk_score: int
    risk_level: str
    classification: str
    rationale: str


class RegularPatternItem(BaseModel):
    pattern_key: str
    ip_address: str
    role: str  # "Regular Source IP", "Regular Destination IP", "Recurring Transfer"
    protocol: str
    port: int
    avg_bytes: float
    frequency: int
    cadence: str


class SuspiciousReportCreate(BaseModel):
    anomaly_id: Optional[int] = None
    source_ip: str
    destination_ip: str
    reason: str
    clearance_violation: Optional[str] = "None"
    severity: Optional[str] = "Medium"


class SuspiciousReportAction(BaseModel):
    decision: str  # "ACTION_TAKEN" or "DISMISSED"
    note: Optional[str] = None


class SuspiciousReportResponse(BaseModel):
    id: int
    anomaly_id: Optional[int]
    reported_by_user_id: int
    reported_by_name: Optional[str]
    source_ip: str
    destination_ip: str
    reason: str
    clearance_violation: str
    severity: str
    status: str
    lead_resolution_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyOverviewResponse(BaseModel):
    behaviors: list[BehaviorRow]
    suspicious_detections: list[BehaviorRow]
    regular_patterns: list[RegularPatternItem]
    classifications: list[BehaviorRow]
    reports: list[SuspiciousReportResponse]