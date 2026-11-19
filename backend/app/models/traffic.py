from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base

class CaptureSession(Base):
    __tablename__ = "capture_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String(100), nullable=False)
    source_type = Column(String(20), nullable=False, default="UPLOAD") # UPLOAD, LIVE, SAMPLE
    total_packets = Column(Integer, default=0, nullable=False)
    total_bytes = Column(BigInteger, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    packets = relationship("PacketRecord", back_populates="session", cascade="all, delete-orphan")

class PacketRecord(Base):
    __tablename__ = "packet_records"

    id = Column(Integer, primary_key=True, index=True)
    capture_id = Column(Integer, ForeignKey("capture_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    src_ip = Column(String(45), nullable=False, index=True)
    src_port = Column(Integer, nullable=True)
    dst_ip = Column(String(45), nullable=False, index=True)
    dst_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=False, index=True) # TCP, UDP, HTTP, HTTPS, DNS, ICMP, ARP, OTHER
    packet_length = Column(Integer, nullable=False)
    direction = Column(String(20), nullable=False, index=True) # INBOUND, OUTBOUND, INTERNAL
    flags = Column(String(50), nullable=True)
    info = Column(String(255), nullable=True)

    # Relationships
    session = relationship("CaptureSession", back_populates="packets")

    __table_args__ = (
        Index("idx_packet_search", "protocol", "direction", "src_ip", "dst_ip"),
    )
