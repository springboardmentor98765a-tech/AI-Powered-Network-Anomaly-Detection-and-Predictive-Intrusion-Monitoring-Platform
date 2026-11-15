import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Role(str, enum.Enum):
    SECURITY_ANALYST = "SECURITY_ANALYST"
    SOC_TEAM = "SOC_TEAM"
    ENTERPRISE = "ENTERPRISE"
    ADMINISTRATOR = "ADMINISTRATOR"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.SECURITY_ANALYST)
    organization_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
