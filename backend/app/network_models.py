
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class NetworkCaptureSession(Base):
    __tablename__ = "network_capture_sessions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    interface_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    interface_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="starting",
        nullable=False,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    packet_count: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )

    total_bytes: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )

    started_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )


class NetworkPacket(Base):
    __tablename__ = "network_packets"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    capture_id: Mapped[int] = mapped_column(
        ForeignKey(
            "network_capture_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    source_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        index=True,
    )

    destination_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        index=True,
    )

    protocol: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="UNKNOWN",
        index=True,
    )

    source_port: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    destination_port: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    packet_length: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    protocol_stack: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    interface_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
