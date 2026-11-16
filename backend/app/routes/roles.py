
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, User
from app.utils.permissions import admin_only


router = APIRouter(
    prefix="/roles",
    tags=["Role Management"]
)


# 1. VIEW ALL AVAILABLE ROLES
@router.get("/")
def get_all_roles(
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):
    roles = db.query(Role).all()

    return [
        {
            "id": role.id,
            "role_name": role.role_name,
            "description": role.description,
            "users": [
                {
                    "id": item.user.id,
                    "full_name": item.user.full_name,
                    "username": item.user.username
                }
                for item in role.user_roles
            ]
        }
        for role in roles
    ]
