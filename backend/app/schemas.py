# NetShield AI — Request/response shapes (Pydantic schemas)
# Developed by Krish | SKK Projects
"""Schemas check incoming data automatically, like a form that rejects empty required fields."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["admin", "analyst", "viewer"]


class LoginRequest(BaseModel):
    username: str
    password: str


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = ""


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str = ""
    password: str = Field(min_length=6)
    role: Role = "analyst"
    team_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Role] = None
    team_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str
    role: str
    team_id: Optional[int]
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class FlowIn(BaseModel):
    """One flow sent for analysis (e.g. from Postman or a sensor)."""
    src_ip: str = "0.0.0.0"
    dst_ip: str = "0.0.0.0"
    src_port: int = 0
    dst_port: int = 0
    protocol: str = "TCP"
    duration: float = 0
    fwd_packets: int = 0
    bwd_packets: int = 0
    fwd_bytes: float = 0
    bwd_bytes: float = 0
    flow_bytes_per_s: Optional[float] = None
    flow_packets_per_s: Optional[float] = None
    syn_count: int = 0
    ack_count: int = 0
    rst_count: int = 0
    fin_count: int = 0
    avg_packet_size: Optional[float] = None

    def to_flow(self) -> dict:
        d = self.model_dump()
        pkts = max(d["fwd_packets"] + d["bwd_packets"], 1)
        total = d["fwd_bytes"] + d["bwd_bytes"]
        dur = max(d["duration"], 1e-3)
        d["flow_bytes_per_s"] = d["flow_bytes_per_s"] if d["flow_bytes_per_s"] is not None else total / dur
        d["flow_packets_per_s"] = d["flow_packets_per_s"] if d["flow_packets_per_s"] is not None else pkts / dur
        d["avg_packet_size"] = d["avg_packet_size"] if d["avg_packet_size"] is not None else total / pkts
        return d


class FlowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    duration: float
    fwd_packets: int
    bwd_packets: int
    fwd_bytes: float
    bwd_bytes: float
    is_anomaly: bool
    anomaly_score: float
    predicted_attack: str
    attack_probability: float
    risk_score: int
    risk_level: str
    threat_intel_hit: bool
    source: str


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    flow_id: Optional[int]
    title: str
    attack_type: str
    severity: str
    risk_score: int
    src_ip: str
    dst_ip: str
    dst_port: int
    status: str
    assigned_to_id: Optional[int]
    incident_id: Optional[int]


class AlertUpdate(BaseModel):
    status: Optional[Literal["open", "acknowledged", "resolved"]] = None
    assigned_to_id: Optional[int] = None


class BulkAlertUpdate(BaseModel):
    ids: list[int]
    status: Literal["open", "acknowledged", "resolved"]


class IncidentCreate(BaseModel):
    title: str = Field(min_length=3)
    description: str = ""
    severity: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    alert_ids: list[int] = []
    assigned_to_id: Optional[int] = None


class IncidentUpdate(BaseModel):
    status: Optional[Literal["open", "investigating", "contained", "closed"]] = None
    severity: Optional[Literal["Low", "Medium", "High", "Critical"]] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[int] = None


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    severity: str
    status: str
    notes: str
    created_by_id: Optional[int]
    assigned_to_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    alert_count: int = 0


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    action: str
    details: str
    ip_address: str
    timestamp: datetime
