from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    actor_user_id: int | None
    actor_name: str | None
    actor_username: str | None
    action: str
    target_type: str | None
    target_id: str | None
    status: str
    timestamp: datetime
    details: dict[str, Any] | None