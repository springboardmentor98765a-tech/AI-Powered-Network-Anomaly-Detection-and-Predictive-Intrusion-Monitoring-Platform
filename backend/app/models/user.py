from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class UserRole:
    ADMIN = "Administrator"
    TEAM_LEAD = "Team Lead / Supervisor"
    ANALYST = "Security Analyst"

    ALL = [ADMIN, TEAM_LEAD, ANALYST]

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.ANALYST)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Foreign key to Team
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    led_teams = relationship("Team", back_populates="lead", foreign_keys="Team.lead_id")
