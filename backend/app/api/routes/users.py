
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.core.dependencies import get_current_admin
from app.core.security import hash_password
from app.services.audit import create_audit_log


router = APIRouter(prefix="/users", tags=["User Management"])


def count_active_admins(db: Session) -> int:
    """Return the number of currently active Admin accounts."""
    return db.scalar(
        select(func.count(User.id))
        .join(Role, User.role_id == Role.id)
        .where(
            Role.name == "Admin",
            User.is_active.is_(True)
        )
    ) or 0


# GET: Retrieve all users
@router.get("/", response_model=list[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    users = db.scalars(
        select(User).order_by(User.id)
    ).all()

    return users


# POST: Create a new user
@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    normalized_email = str(user_data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(User.email == normalized_email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )

    role = db.scalar(
        select(Role).where(Role.id == user_data.role_id)
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected role does not exist"
        )

    new_user = User(
        full_name=user_data.full_name,
        email=normalized_email,
        hashed_password=hash_password(user_data.password),
        role_id=role.id,
        is_active=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        create_audit_log(
            db=db,
            action="CREATE",
            entity_type="USER",
            user_id=current_admin.id,
            entity_id=str(new_user.id),
            description=f"Admin created user {new_user.email}"
        )

    except Exception:
        db.rollback()
        raise

    return new_user


# PUT: Update an existing user
@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    role = db.scalar(
        select(Role).where(Role.id == user_data.role_id)
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected role does not exist"
        )

    # Prevent self-deactivation or self-role changes.
    if user.id == current_admin.id:
        if (
            not user_data.is_active
            or role.name != "Admin"
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate yourself or change your own role"
            )

    # Protect the last active Admin account.
    currently_admin = db.get(Role, user.role_id)

    if (
        currently_admin
        and currently_admin.name == "Admin"
        and user.is_active
        and (
            role.name != "Admin"
            or not user_data.is_active
        )
    ):
        if count_active_admins(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove or deactivate the last active Admin"
            )

    user.full_name = user_data.full_name
    user.role_id = role.id
    user.is_active = user_data.is_active

    try:
        db.commit()
        db.refresh(user)

        create_audit_log(
            db=db,
            action="UPDATE",
            entity_type="USER",
            user_id=current_admin.id,
            entity_id=str(user.id),
            description=f"Admin updated user {user.email}"
        )

    except Exception:
        db.rollback()
        raise

    return user


# DELETE: Remove an existing user
@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-deletion.
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    # Protect the last active Admin account.
    role = db.get(Role, user.role_id)

    if (
        role
        and role.name == "Admin"
        and user.is_active
        and count_active_admins(db) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last active Admin"
        )

    deleted_email = user.email

    try:
        db.delete(user)
        db.commit()

        create_audit_log(
            db=db,
            action="DELETE",
            entity_type="USER",
            user_id=current_admin.id,
            entity_id=str(user_id),
            description=f"Admin deleted user {deleted_email}"
        )

    except Exception:
        db.rollback()
        raise

    return {
        "message": "User deleted successfully",
        "user_id": user_id
    }
