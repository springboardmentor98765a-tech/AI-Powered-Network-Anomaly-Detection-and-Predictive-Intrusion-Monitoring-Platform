from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Table,  Float, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

# Junction table for User-Roles (many-to-many)
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# Junction table for Team-Members (many-to-many)
team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime(timezone=True), default=datetime.utcnow),
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    status = Column(String(20), default="active")  # 'active' or 'inactive'
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    teams = relationship("Team", secondary=team_members, back_populates="members")

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)  # 'Administrator', 'Security Analyst', 'Team Lead'
    description = Column(Text)

    users = relationship("User", secondary=user_roles, back_populates="roles")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    team_name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    members = relationship("User", secondary=team_members, back_populates="teams")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    target_type = Column(String(50))
    target_id = Column(String(50))
    status = Column(String(20), nullable=False)  # 'SUCCESS' or 'FAILURE'
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    details = Column(Text)  # JSON-encoded string or JSONB

class NetworkFlow(Base):
    __tablename__ = "network_flows"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    source_ip = Column(String(45), index=True)
    destination_ip = Column(String(45), index=True)
    source_port = Column(Integer, default=0)
    destination_port = Column(Integer, default=0)
    protocol = Column(String(16), index=True)
    packet_length = Column(Integer, default=0)
    flow_duration = Column(Float, default=0.0)
    flag = Column(String(24), nullable=True)
    status = Column(String(20), default="NORMAL")
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_flow_ip_proto", "source_ip", "destination_ip", "protocol"),
    )
    
class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    source_ip = Column(String(45), index=True)
    destination_ip = Column(String(45), index=True)
    protocol = Column(String(16), index=True)
    destination_port = Column(Integer, default=0)
    packet_count = Column(Integer, default=1)
    total_bytes = Column(Integer, default=0)
    avg_packet_size = Column(Float, default=0.0)
    flow_rate_pps = Column(Float, default=0.0)
    syn_ratio = Column(Float, default=0.0)
    behavioral_profile = Column(String(120))
    detection_trigger = Column(String(160))  # e.g., "New External IP", "Clearance Escalation", "Port Sweep"
    is_new_ip = Column(Integer, default=0)
    unauthorized_clearance = Column(Integer, default=0)
    risk_score = Column(Integer, default=0)  # 0 - 100
    risk_level = Column(String(20), default="Low")  # Critical, High, Medium, Low
    classification = Column(String(30), default="MISTAKE")  # DANGEROUS, RISK_ASSESSED, MISTAKE
    rationale = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)


class SuspiciousReport(Base):
    __tablename__ = "suspicious_reports"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"), nullable=True)
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_by_name = Column(String(120))
    assigned_lead_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    source_ip = Column(String(45), index=True)
    destination_ip = Column(String(45), index=True)
    reason = Column(Text, nullable=False)
    clearance_violation = Column(String(120), default="None")
    severity = Column(String(20), default="Medium")
    status = Column(String(24), default="PENDING_LEAD_REVIEW")  # PENDING_LEAD_REVIEW, ACTION_TAKEN, DISMISSED
    lead_resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)