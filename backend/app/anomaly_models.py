from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class SuspiciousActivityReport(Base):
    """Analyst-submitted activity report reviewed by the assigned team lead."""

    __tablename__ = "suspicious_activity_reports"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'ACTION_TAKEN', 'DISMISSED')",
            name="check_suspicious_report_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reported_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    destination_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False, index=True
    )
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    team = relationship("Team")
    reporter = relationship("User", foreign_keys=[reported_by_user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_user_id])


class ProtectedDataResource(Base):
    """A resource whose content is returned only at sufficient clearance."""

    __tablename__ = "protected_data_resources"

    __table_args__ = (
        CheckConstraint(
            "classification_level BETWEEN 1 AND 4",
            name="check_resource_classification_level",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    resource_key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    resource_name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    classification_level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    demo_content: Mapped[str] = mapped_column(Text, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
