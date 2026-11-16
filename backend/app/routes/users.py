
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role, UserRole, AuthSession, AuditLog
from app.schemas.users import (
    UserCreate,
    UserUpdate,
    RoleUpdate,
    UserStatusUpdate,
    PasswordReset
)
from app.utils.permissions import admin_only
from app.utils.security import hash_password

from datetime import datetime, timezone


router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


# Helper function to format user information
def format_user(user):

    return {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "roles": [
            item.role.role_name
            for item in user.user_roles
        ]
    }


# 1. CREATE USER
@router.post("/")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    # Check duplicate username or email
    existing = db.query(User).filter(
        (User.username == data.username) |
        (User.email == data.email)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Username or email already exists"
        )

    # Validate requested roles
    roles = db.query(Role).filter(
        Role.role_name.in_(data.roles)
    ).all()

    if len(roles) != len(set(data.roles)):
        raise HTTPException(
            status_code=400,
            detail="One or more roles are invalid"
        )

    try:
        # Create new user
        new_user = User(
            full_name=data.full_name,
            username=data.username,
            email=data.email,
            password_hash=hash_password(data.password),
            is_active=True
        )

        db.add(new_user)
        db.flush()

        # Assign roles
        for role in roles:
            db.add(UserRole(
                user_id=new_user.id,
                role_id=role.id
            ))

        # Audit log
        db.add(AuditLog(
            actor_user_id=current_admin.id,
            action="USER_CREATED",
            target_type="USER",
            target_id=new_user.id,
            status="SUCCESS"
        ))

        db.commit()
        db.refresh(new_user)

        return format_user(new_user)

    except Exception:
        db.rollback()
        raise


# 2. VIEW ALL USERS
@router.get("/")
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    users = db.query(User).all()

    return [
        format_user(user)
        for user in users
    ]


# 3. VIEW ONE USER
@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return format_user(user)


# 4. UPDATE USER PROFILE
@router.put("/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update"
        )

    for field, value in updates.items():

        duplicate = db.query(User).filter(
            getattr(User, field) == value,
            User.id != user_id
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=f"{field} already exists"
            )

        setattr(user, field, value)

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="PROFILE_UPDATED",
        target_type="USER",
        target_id=user.id,
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(user)

    return format_user(user)


# 5. UPDATE USER ROLES
@router.put("/{user_id}/roles")
def update_user_roles(
    user_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    role_names = set(data.roles)

    roles = db.query(Role).filter(
        Role.role_name.in_(role_names)
    ).all()

    if len(roles) != len(role_names):
        raise HTTPException(
            status_code=400,
            detail="One or more roles are invalid"
        )

    # Prevent removing the last administrator
    has_admin = any(
        item.role.role_name == "Administrator"
        for item in user.user_roles
    )

    keeps_admin = "Administrator" in role_names

    if has_admin and not keeps_admin:
        admin_count = db.query(UserRole).join(Role).filter(
            Role.role_name == "Administrator"
        ).count()

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last administrator"
            )

    # Replace existing roles
    db.query(UserRole).filter(
        UserRole.user_id == user.id
    ).delete(synchronize_session=False)

    for role in roles:
        db.add(UserRole(
            user_id=user.id,
            role_id=role.id
        ))

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="ROLE_UPDATED",
        target_type="USER",
        target_id=user.id,
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(user)

    return format_user(user)


# 6. ACTIVATE / DEACTIVATE USER
@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.id == current_admin.id and not data.is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    if user.is_active == data.is_active:
        raise HTTPException(
            status_code=400,
            detail="Account already has this status"
        )

    user.is_active = data.is_active

    action = "USER_ACTIVATED" if data.is_active else "USER_DEACTIVATED"

    # Revoke sessions when deactivating
    if not data.is_active:

        sessions = db.query(AuthSession).filter(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None)
        ).all()

        now = datetime.now(timezone.utc)

        for session in sessions:
            session.revoked_at = now

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action=action,
        target_type="USER",
        target_id=user.id,
        status="SUCCESS"
    ))

    db.commit()

    return {
        "message": "Account status updated successfully",
        "user": format_user(user)
    }


# 7. ADMINISTRATOR PASSWORD RESET
@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Hash the new password
    user.password_hash = hash_password(data.new_password)

    # Revoke all active sessions
    sessions = db.query(AuthSession).filter(
        AuthSession.user_id == user.id,
        AuthSession.revoked_at.is_(None)
    ).all()

    now = datetime.now(timezone.utc)

    for session in sessions:
        session.revoked_at = now

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="PASSWORD_RESET",
        target_type="USER",
        target_id=user.id,
        status="SUCCESS"
    ))

    db.commit()

    return {
        "message": "Password reset successfully. User must log in again."
    }
