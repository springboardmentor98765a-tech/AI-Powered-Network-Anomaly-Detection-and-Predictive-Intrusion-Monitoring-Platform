from datetime import datetime
from pydantic import BaseModel

class AuditLogResponse(BaseModel):
    id: int
    actor_id: int | None = None
    actor_username: str
    action: str
    target_type: str
    target_id: str | None = None
    status: str
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class AuditStatsResponse(BaseModel):
    total_logs: int
    successful_logins_24h: int
    failed_logins_24h: int
    total_actions_today: int
    most_active_users: list[dict]
