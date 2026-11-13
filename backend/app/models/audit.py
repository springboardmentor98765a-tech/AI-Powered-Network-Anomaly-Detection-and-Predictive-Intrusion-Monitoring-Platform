from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.db.session import Base

class AuditAction:
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    USER_STATUS_CHANGE = "USER_STATUS_CHANGE"
    USER_ROLE_CHANGE = "USER_ROLE_CHANGE"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET = "PASSWORD_RESET"

    TEAM_CREATE = "TEAM_CREATE"
    TEAM_UPDATE = "TEAM_UPDATE"
    TEAM_DELETE = "TEAM_DELETE"
    TEAM_MEMBER_ADD = "TEAM_MEMBER_ADD"
    TEAM_MEMBER_REMOVE = "TEAM_MEMBER_REMOVE"

class AuditStatus:
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, nullable=True, index=True)
    actor_username = Column(String(50), nullable=False, default="ANONYMOUS", index=True)
    action = Column(String(50), nullable=False, index=True)
    target_type = Column(String(50), nullable=False, index=True)  # AUTH, USER, TEAM, SYSTEM
    target_id = Column(String(100), nullable=True, index=True)
    status = Column(String(20), nullable=False, default=AuditStatus.SUCCESS, index=True)
    details = Column(Text, nullable=True)  # Sanitized JSON summary (NO passwords/secrets)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
