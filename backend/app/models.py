# NetShield AI — Database tables (SQLAlchemy models)
# Developed by Krish | SKK Projects
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base, utcnow


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), default="")
    created_at = Column(DateTime, default=utcnow)
    members = relationship("User", back_populates="team")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    full_name = Column(String(120), default="")
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="analyst")  # admin | analyst | viewer
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    team = relationship("Team", back_populates="members")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String(50), default="system")
    action = Column(String(80), nullable=False)
    details = Column(Text, default="")
    ip_address = Column(String(64), default="")
    timestamp = Column(DateTime, default=utcnow, index=True)


class TrafficFlow(Base):
    """One network 'conversation' between two computers, plus what the AI thinks of it."""
    __tablename__ = "traffic_flows"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    src_ip = Column(String(64))
    dst_ip = Column(String(64))
    src_port = Column(Integer, default=0)
    dst_port = Column(Integer, default=0)
    protocol = Column(String(10), default="TCP")
    # Features used by the ML models
    duration = Column(Float, default=0)
    fwd_packets = Column(Integer, default=0)
    bwd_packets = Column(Integer, default=0)
    fwd_bytes = Column(Float, default=0)
    bwd_bytes = Column(Float, default=0)
    flow_bytes_per_s = Column(Float, default=0)
    flow_packets_per_s = Column(Float, default=0)
    syn_count = Column(Integer, default=0)
    ack_count = Column(Integer, default=0)
    rst_count = Column(Integer, default=0)
    fin_count = Column(Integer, default=0)
    avg_packet_size = Column(Float, default=0)
    # AI results
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0)
    predicted_attack = Column(String(30), default="BENIGN", index=True)
    attack_probability = Column(Float, default=0)
    risk_score = Column(Integer, default=0)
    risk_level = Column(String(10), default="Low")
    threat_intel_hit = Column(Boolean, default=False)
    source = Column(String(20), default="sensor")  # sensor | upload


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    severity = Column(String(10), default="Medium")
    status = Column(String(20), default="open")  # open | investigating | contained | closed
    notes = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    alerts = relationship("Alert", back_populates="incident")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    flow_id = Column(Integer, ForeignKey("traffic_flows.id"))
    title = Column(String(200))
    attack_type = Column(String(30))
    severity = Column(String(10))  # Low | Medium | High | Critical
    risk_score = Column(Integer)
    src_ip = Column(String(64))
    dst_ip = Column(String(64))
    dst_port = Column(Integer, default=0)
    status = Column(String(20), default="open")  # open | acknowledged | resolved
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    incident = relationship("Incident", back_populates="alerts")
