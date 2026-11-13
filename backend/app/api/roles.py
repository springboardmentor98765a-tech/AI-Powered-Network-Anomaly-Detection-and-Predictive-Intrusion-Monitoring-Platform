from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Role
from app.api.deps import require_roles


router = APIRouter(
    prefix="/roles",
    tags=["Role Management"]
)


@router.get("")
def get_roles(
    db: Session = Depends(get_db),
    admin=Depends(require_roles("Administrator"))
):
    """List all available roles. Administrator only."""

    roles = db.scalars(
        select(Role).order_by(Role.id)
    ).all()

    return [
        {
            "id": role.id,
            "role_name": role.role_name,
            "description": role.description
        }
        for role in roles
    ]