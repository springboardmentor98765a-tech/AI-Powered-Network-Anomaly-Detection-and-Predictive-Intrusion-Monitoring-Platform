from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Role, User
from app.permissions import ROLE_PERMISSIONS
from app.schemas import RoleOut

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleOut])
def list_roles(
    admin: User = Depends(require_roles("administrator")),
    db: Session = Depends(get_db),
):
    return db.query(Role).order_by(Role.id).all()


@router.get("/permissions")
def role_permissions(current_user: User = Depends(get_current_user)):
    return ROLE_PERMISSIONS