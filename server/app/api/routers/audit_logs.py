from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditLog, User
from app.api.dependencies import require_roles
from pydantic import BaseModel

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])

# --- Pydantic Response Schema ---
class AuditLogResponse(BaseModel):
    id: int
    actor_user_id: int | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    status: str
    timestamp: datetime
    details: str | None = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[AuditLogResponse])
def get_audit_logs(
    user_id: int | None = Query(None, description="Filter by specific actor user ID"),
    action: str | None = Query(None, description="Search keyword in actions (e.g., LOGIN)"),
    status: str | None = Query(None, description="Filter by SUCCESS or FAILURE"),
    start_date: datetime | None = Query(None, description="Filter logs starting from this timestamp"),
    end_date: datetime | None = Query(None, description="Filter logs up to this timestamp"),
    limit: int = Query(50, le=200, description="Max number of records to return"),
    offset: int = Query(0, description="Pagination offset"),
    current_user: User = Depends(require_roles(["Administrator"])),
    db: Session = Depends(get_db)
):
    """
    Retrieve and filter system audit logs. Restricted strictly to Administrators[cite: 11].
    """
    query = db.query(AuditLog)
    
    # Apply filters dynamically
    if user_id is not None:
        query = query.filter(AuditLog.actor_user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if status:
        query = query.filter(AuditLog.status == status.upper())
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
        
    # Order by newest first with pagination limits
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return logs