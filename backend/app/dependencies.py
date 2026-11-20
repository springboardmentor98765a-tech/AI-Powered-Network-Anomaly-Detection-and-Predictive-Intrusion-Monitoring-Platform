from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RevokedToken
from app.security import decode_access_token

# Reads the "Authorization: Bearer <token>" header from each request
bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """Check the token is present, valid, not expired, and not revoked."""
    if credentials is None:
        raise CREDENTIALS_ERROR

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise CREDENTIALS_ERROR

    # Was this token revoked by a logout?
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == payload.get("jti")).first()
    if revoked:
        raise CREDENTIALS_ERROR

    return payload


def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    """Load the user from the token and make sure the account is still active."""
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if user is None or user.status != "active":
        raise CREDENTIALS_ERROR
    return user


def require_roles(*allowed_roles: str):
    """
    Role-based access control (RBAC).
    Usage: Depends(require_roles("administrator"))
    """

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_names = {role.role_name for role in current_user.roles}
        if not user_role_names.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker


def cleanup_expired_revoked_tokens(db: Session) -> None:
    """Remove revoked tokens that have already expired (keeps the table small)."""
    db.query(RevokedToken).filter(
        RevokedToken.expires_at < datetime.now(timezone.utc)
    ).delete()
    db.commit()