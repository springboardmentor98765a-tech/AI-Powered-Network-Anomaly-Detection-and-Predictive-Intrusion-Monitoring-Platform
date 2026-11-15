from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Table
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