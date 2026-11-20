from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Table,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ---------- Link tables (many-to-many) ----------

# Connects users to roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# Connects users to teams
team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime(timezone=True), default=utcnow),
)


# ---------- Main tables ----------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active / inactive
    created_at = Column(DateTime(timezone=True), default=utcnow)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    teams = relationship("Team", secondary=team_members, back_populates="members")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))

    users = relationship("User", secondary=user_roles, back_populates="roles")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    team_name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    members = relationship("User", secondary=team_members, back_populates="teams")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)       # e.g. "LOGIN", "CREATE_USER"
    target_type = Column(String(50))                    # e.g. "user", "team"
    target_id = Column(Integer)
    status = Column(String(20), nullable=False)         # "success" / "failure"
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True)
    jti = Column(String(64), unique=True, index=True, nullable=False)  # unique token ID
    expires_at = Column(DateTime(timezone=True), nullable=False)