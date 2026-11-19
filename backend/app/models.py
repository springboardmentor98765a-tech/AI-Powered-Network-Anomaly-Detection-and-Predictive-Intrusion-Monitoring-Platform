from datetime import datetime, timezone
import enum
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    role_name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=False)
    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    role = relationship("Role", back_populates="users")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete")


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    team_name = Column(String(120), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    members = relationship("TeamMember", back_populates="team", cascade="all, delete")


class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(80), nullable=False, index=True)
    target_type = Column(String(80), nullable=False)
    target_id = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    details = Column(Text)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    jti = Column(String(64), primary_key=True)
    expires_at = Column(DateTime, nullable=False)
