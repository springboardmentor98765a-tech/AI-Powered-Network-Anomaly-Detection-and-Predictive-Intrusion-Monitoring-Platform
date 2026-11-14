
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    action: str,
    entity_type: str,
    user_id: int | None = None,
    entity_id: str | None = None,
    description: str | None = None,
    ip_address: str | None = None
):
    """
    Save a user activity record in the audit_logs table.
    """

    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ip_address
    )

    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)

    return audit_entry
