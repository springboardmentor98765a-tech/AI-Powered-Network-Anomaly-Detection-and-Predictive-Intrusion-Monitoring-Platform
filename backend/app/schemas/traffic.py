from datetime import datetime
from pydantic import BaseModel, Field

class PacketResponse(BaseModel):
    id: int
    timestamp: datetime
    src_ip: str
    src_port: int | None = None
    dst_ip: str
    dst_port: int | None = None
    protocol: str
    packet_length: int
    direction: str
    flags: str | None = None
    info: str | None = None

    class Config:
        from_attributes = True

class ProtocolStatItem(BaseModel):
    protocol: str
    packets: int
    bytes: int
    packet_percentage: float
    byte_percentage: float
    description: str | None = None

class TopTalkerItem(BaseModel):
    ip: str
    hostname: str | None = None
    packets: int
    bytes: int
    formatted_bytes: str | None = None
    sessions: int = 1
    packet_percentage: float
    byte_percentage: float

class TrafficTimeSeriesPoint(BaseModel):
    time: str
    timestamp: datetime
    packets: int
    bytes: int
    inbound_packets: int = 0
    outbound_packets: int = 0

class DirectionStats(BaseModel):
    inbound_packets: int
    inbound_bytes: int
    outbound_packets: int
    outbound_bytes: int
    internal_packets: int
    internal_bytes: int

class TrafficOverviewResponse(BaseModel):
    total_packets: int
    total_bytes: int
    formatted_bytes: str
    active_connections: int
    direction_stats: DirectionStats
    protocol_stats: list[ProtocolStatItem]
    top_sources: list[TopTalkerItem]
    top_destinations: list[TopTalkerItem]
    time_series: list[TrafficTimeSeriesPoint]

class ProtocolAnalysisDetail(BaseModel):
    protocol: str
    category: str # "Transport", "Application", "Link / Internet", "Unclassified"
    packet_count: int
    byte_volume: int
    packet_percentage: float
    byte_percentage: float
    avg_packet_size: float
    characteristics: str

class ProtocolAnalysisResponse(BaseModel):
    total_packets: int
    total_bytes: int
    protocols: list[ProtocolAnalysisDetail]
    tcp_count: int
    udp_count: int
    tcp_vs_udp_ratio: str
    unclassified_count: int
    unclassified_bytes: int
