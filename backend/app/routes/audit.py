
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, AuditLog
from app.utils.permissions import admin_only


router = APIRouter(
    prefix="/audit",
    tags=["Audit Logging"]
)


# 1. VIEW ALL AUDIT LOGS
@router.get("/")
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    if skip < 0 or limit < 1 or limit > 100:
        raise HTTPException(
            status_code=400,
            detail="Invalid pagination values"
        )

    logs = db.query(AuditLog).order_by(
        AuditLog.timestamp.desc()
    ).offset(skip).limit(limit).all()

    return [
        {
            "id": log.id,
            "actor_user_id": log.actor_user_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "status": log.status,
            "timestamp": log.timestamp,
            "details": log.details
        }
        for log in logs
    ]


# 2. VIEW ONE AUDIT LOG
@router.get("/{log_id}")
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    log = db.query(AuditLog).filter(
        AuditLog.id == log_id
    ).first()

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Audit log not found"
        )

    return {
        "id": log.id,
        "actor_user_id": log.actor_user_id,
        "action": log.action,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "status": log.status,
        "timestamp": log.timestamp,
        "details": log.details
    }


# 3. FILTER AUDIT LOGS
@router.get("/search/filter")
def filter_audit_logs(
    action: str = None,
    status: str = None,
    actor_user_id: int = None,
    target_type: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    query = db.query(AuditLog)

    if action:
        query = query.filter(
            AuditLog.action == action
        )

    if status:
        query = query.filter(
            AuditLog.status == status
        )

    if actor_user_id is not None:
        query = query.filter(
            AuditLog.actor_user_id == actor_user_id
        )

    if target_type:
        query = query.filter(
            AuditLog.target_type == target_type
        )

    logs = query.order_by(
        AuditLog.timestamp.desc()
    ).limit(100).all()

    return [
        {
            "id": log.id,
            "actor_user_id": log.actor_user_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "status": log.status,
            "timestamp": log.timestamp,
            "details": log.details
        }
        for log in logs
    ]
