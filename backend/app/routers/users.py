from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserRoleUpdate, UserStatusUpdate
from app.services import audit_service, user_service    # was: user_service only
from app.schemas.team import UserBrief

router = APIRouter(prefix="/users", tags=["users"])

admin_only = require_roles("admin")


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = user_service.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    try:
        new_user = user_service.create_user(db, data)
    except user_service.DuplicateEmailError:
        raise HTTPException(status_code=409, detail="Email already registered")
    except user_service.DuplicateUsernameError:
        raise HTTPException(status_code=409, detail="Username already taken")
    except user_service.RoleNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid role_id")
    audit_service.log_event(db, admin.id, "user_create", "user", new_user.id,
                            details=f"username: {new_user.username}")
    return new_user


@router.get("", response_model=list[UserOut])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),  # cap the page size so nobody can ask for a million rows
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    return user_service.list_users(db, skip, limit)


# /me MUST be declared before /{user_id}
@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/directory", response_model=list[UserBrief])
def user_directory(
    q: str | None = Query(None, max_length=50),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "team_lead")),
):
    return user_service.search_active_users(db, q, limit)

@router.get("/{user_id}", response_model=UserOut)
def read_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)
):
    return _get_user_or_404(db, user_id)


@router.patch("/{user_id}/status", response_model=UserOut)
def update_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = _get_user_or_404(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own status")
    old_status = user.status
    updated = user_service.set_status(db, user, data.status)
    audit_service.log_event(db, admin.id, "user_status_change", "user", user.id,
                            details=f"{old_status} -> {updated.status}")
    return updated


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = _get_user_or_404(db, user_id)
    old_role = user.role.role_name
    try:
        updated = user_service.set_role(db, user, data.role_id)
    except user_service.RoleNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid role_id")
    audit_service.log_event(db, admin.id, "role_change", "user", user.id,
                            details=f"{old_role} -> {updated.role.role_name}")
    return updated