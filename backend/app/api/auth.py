
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User, AuthSession, AuditLog

from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    ChangePasswordRequest
)

from app.core.security import (
    verify_password,
    hash_password,
    create_access_token
)

from app.api.deps import (
    get_current_user,
    get_current_session
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate a user and issue a JWT."""

    identifier = data.identifier.strip().lower()

    user = db.scalar(
        select(User).where(
            or_(
                func.lower(User.email) == identifier,
                func.lower(User.username) == identifier
            )
        )
    )

    password_valid = (
        user is not None
        and verify_password(data.password, user.password_hash)
    )

    if user is None or not password_valid or user.status != "active":

        db.add(
            AuditLog(
                actor_user_id=None,
                action="LOGIN",
                target_type="User" if user else None,
                target_id=str(user.id) if user else None,
                status="FAILED",
                details={
                    "reason": "invalid_credentials_or_inactive_account"
                }
            )
        )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    token, token_id, expires_at = create_access_token(user.id)

    auth_session = AuthSession(
        user_id=user.id,
        token_jti=token_id,
        expires_at=expires_at
    )

    user.last_login_at = datetime.now(timezone.utc)

    db.add(auth_session)

    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="LOGIN",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={"method": "password"}
        )
    )

    db.commit()

    expires_in = max(
        0,
        int((expires_at - datetime.now(timezone.utc)).total_seconds())
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in
    )


@router.get("/me", response_model=UserResponse)
def get_profile(
    user: User = Depends(get_current_user)
):
    """Return the authenticated user's profile."""

    return UserResponse(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        status=user.status,
        roles=[role.role_name for role in user.roles],
        last_login_at=user.last_login_at
    )


@router.post("/logout")
def logout(
    auth_session: AuthSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Revoke the current authentication session."""

    auth_session.revoked_at = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            actor_user_id=auth_session.user_id,
            action="LOGOUT",
            target_type="User",
            target_id=str(auth_session.user_id),
            status="SUCCESS",
            details={"method": "session_revocation"}
        )
    )

    db.commit()

    return {
        "message": "Successfully logged out."
    }


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    auth_session: AuthSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """Change password and revoke all existing sessions."""

    user = auth_session.user

    # Verify current password.
    if not verify_password(
        data.current_password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect."
        )

    # Prevent reuse of the current password.
    if verify_password(
        data.new_password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password."
        )

    # Hash and save the new password.
    user.password_hash = hash_password(data.new_password)

    now = datetime.now(timezone.utc)

    # Revoke every active session belonging to this user.
    active_sessions = db.scalars(
        select(AuthSession).where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None)
        )
    ).all()

    for session in active_sessions:
        session.revoked_at = now

    # Record the event without storing password information.
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="PASSWORD_CHANGED",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={
                "sessions_revoked": len(active_sessions)
            }
        )
    )

    db.commit()

    return {
        "message": "Password changed successfully. Please log in again."
    }
