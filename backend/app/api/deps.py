import jwt
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import AuthSession, User
from app.core.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):
    """Validate JWT and check whether its database session is active."""

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"}
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)

        user_id = int(payload["sub"])
        token_id = payload["jti"]

    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise unauthorized

    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_jti == token_id
        )
    )

    if auth_session is None:
        raise unauthorized

    if auth_session.user_id != user_id:
        raise unauthorized

    if auth_session.revoked_at is not None:
        raise unauthorized

    if auth_session.expires_at <= datetime.now(timezone.utc):
        raise unauthorized

    if auth_session.user.status != "active":
        raise unauthorized

    return auth_session


def get_current_user(
    auth_session: AuthSession = Depends(get_current_session)
):
    """Return the authenticated user."""

    return auth_session.user


def require_roles(*allowed_roles: str):
    """
    Create a reusable permission dependency.

    A user needs at least one of the specified roles.
    """

    def role_checker(
        current_user: User = Depends(get_current_user)
    ):
        user_roles = {
            role.role_name for role in current_user.roles
        }

        if not user_roles.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action."
            )

        return current_user

    return role_checker