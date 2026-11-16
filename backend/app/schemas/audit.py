
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class AuditLogResponse(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    status: str
    timestamp: Optional[datetime] = None
    details: Optional[dict[str, Any]] = None


class AuditLogFilter(BaseModel):
    action: Optional[str] = None
    status: Optional[str] = None
    actor_user_id: Optional[int] = None
    target_type: Optional[str] = None
