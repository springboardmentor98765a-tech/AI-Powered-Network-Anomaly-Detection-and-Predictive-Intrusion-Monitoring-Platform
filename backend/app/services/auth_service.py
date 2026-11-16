
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.models import User, AuthSession, AuditLog
from app.utils.security import (
    verify_password,
    create_access_token
)


def login_user(db: Session, identifier: str, password: str):

    # Find user using username or email
    user = db.query(User).filter(
        or_(
            func.lower(User.email) == identifier.lower(),
            func.lower(User.username) == identifier.lower()
        )
    ).first()

    # Verify password
    if not user or not verify_password(password, user.password_hash):

        # Record failed login
        log = AuditLog(
            actor_user_id=user.id if user else None,
            action="LOGIN",
            target_type="USER",
            target_id=user.id if user else None,
            status="FAILURE",
            details={"reason": "Invalid credentials"}
        )

        db.add(log)
        db.commit()

        return None

    # Check account status
    if not user.is_active:

        log = AuditLog(
            actor_user_id=user.id,
            action="LOGIN",
            target_type="USER",
            target_id=user.id,
            status="FAILURE",
            details={"reason": "Inactive account"}
        )

        db.add(log)
        db.commit()

        return None

    # Generate JWT
    token, jti, expiry = create_access_token(user.id)

    # Create database session
    auth_session = AuthSession(
        user_id=user.id,
        token_jti=jti,
        expires_at=expiry
    )

    # Record successful login
    log = AuditLog(
        actor_user_id=user.id,
        action="LOGIN",
        target_type="USER",
        target_id=user.id,
        status="SUCCESS",
        details={"method": "password"}
    )

    db.add(auth_session)
    db.add(log)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": int((expiry - datetime.now(timezone.utc)).total_seconds()),
        "user": user
    }
