from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuditLog
from ..dependencies import require_permission
from ..models import User

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("/")
def list_audit(search: str = "", action: str = "", status: str = "", actor_user_id: int | None = None,
               date_from: str = "", date_to: str = "",
               page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               db: Session = Depends(get_db), actor: User = Depends(require_permission("audit.view"))):
    query = db.query(AuditLog)
    if search:
        like = f"%{search}%"
        query = query.filter(AuditLog.details.ilike(like) | AuditLog.action.ilike(like) | AuditLog.target_type.ilike(like))
    if action:
        query = query.filter(AuditLog.action == action)
    if status:
        query = query.filter(AuditLog.status == status)
    if actor_user_id:
        query = query.filter(AuditLog.actor_user_id == actor_user_id)
    if date_from:
        query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(date_from.replace("Z", "+00:00")))
    if date_to:
        query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(date_to.replace("Z", "+00:00")))
    total = query.count()
    items = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{log_id}")
def get_audit(log_id: int, db: Session = Depends(get_db), actor: User = Depends(require_permission("audit.view"))):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return log
