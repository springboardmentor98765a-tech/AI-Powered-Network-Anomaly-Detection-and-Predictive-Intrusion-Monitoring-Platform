from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.audit import log_action
from app.database import get_db
from app.dependencies import get_current_user, get_token_payload, require_roles
from app.models import Role, RevokedToken, User
from app.schemas import (
    AdminPasswordReset,
    ChangePassword,
    UserCreate,
    UserOut,
    UserRolesUpdate,
    UserUpdate,
)
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])

# Shortcut: only administrators may use endpoints that include this
admin_only = require_roles("administrator")


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------- Change my own password (any logged-in user) ----------
# Defined BEFORE "/{user_id}" routes so "me" is never mistaken for an ID.

@router.put("/me/password")
def change_my_password(
    data: ChangePassword,
    payload: dict = Depends(get_token_payload),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        log_action(db, "CHANGE_PASSWORD", "failure", actor_user_id=current_user.id,
                   target_type="user", target_id=current_user.id, details="Wrong current password")
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current one")

    current_user.password_hash = hash_password(data.new_password)

    # Revoke the current token so the user must log in again with the new password
    db.add(
        RevokedToken(
            jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        )
    )
    db.commit()

    log_action(db, "CHANGE_PASSWORD", "success", actor_user_id=current_user.id,
               target_type="user", target_id=current_user.id)
    return {"message": "Password changed. Please log in again."}


# ---------- Create user (administrator only) ----------

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    email = data.email.lower()
    username = data.username.lower()

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email is already registered")
    if db.query(User).filter(func.lower(User.username) == username).first():
        raise HTTPException(status_code=409, detail="Username is already taken")

    role = db.query(Role).filter(Role.role_name == data.role).first()
    if role is None:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        name=data.name,
        username=username,
        email=email,
        password_hash=hash_password(data.password),
        status="active",
    )
    user.roles.append(role)
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, "CREATE_USER", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id, details=f"Role: {role.role_name}")
    return user


# ---------- List users (administrator only) ----------

@router.get("", response_model=list[UserOut])
def list_users(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status", pattern=r"^(active|inactive)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(User.name).like(term),
                func.lower(User.username).like(term),
                func.lower(User.email).like(term),
            )
        )
    if status_filter:
        query = query.filter(User.status == status_filter)

    return query.order_by(User.id).offset(skip).limit(limit).all()


# ---------- View one user ----------

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return get_user_or_404(db, user_id)


# ---------- Update user ----------

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(db, user_id)

    if data.name is not None:
        user.name = data.name

    if data.email is not None:
        new_email = data.email.lower()
        taken = (
            db.query(User)
            .filter(func.lower(User.email) == new_email, User.id != user.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=409, detail="Email is already registered")
        user.email = new_email

    if data.status is not None:
        if user.id == admin.id and data.status == "inactive":
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        user.status = data.status

    db.commit()
    db.refresh(user)

    log_action(db, "UPDATE_USER", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id)
    return user


# ---------- Activate / Deactivate ----------

@router.post("/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: int,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(db, user_id)
    user.status = "active"
    db.commit()
    db.refresh(user)

    log_action(db, "ACTIVATE_USER", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id)
    return user


@router.post("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(db, user_id)

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    user.status = "inactive"
    db.commit()
    db.refresh(user)

    log_action(db, "DEACTIVATE_USER", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id)
    return user


# ---------- Assign roles ----------

@router.put("/{user_id}/roles", response_model=UserOut)
def assign_roles(
    user_id: int,
    data: UserRolesUpdate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(db, user_id)

    role_names = set(data.roles)
    roles = db.query(Role).filter(Role.role_name.in_(role_names)).all()
    if len(roles) != len(role_names):
        raise HTTPException(status_code=400, detail="One or more roles are invalid")

    if user.id == admin.id and "administrator" not in role_names:
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator role")

    user.roles = roles
    db.commit()
    db.refresh(user)

    log_action(db, "ASSIGN_ROLES", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id, details=", ".join(sorted(role_names)))
    return user


# ---------- Admin resets a user's password ----------

@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: AdminPasswordReset,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(db, user_id)
    user.password_hash = hash_password(data.new_password)
    db.commit()

    log_action(db, "RESET_PASSWORD", "success", actor_user_id=admin.id,
               target_type="user", target_id=user.id)
    return {"message": "Password reset successfully"}