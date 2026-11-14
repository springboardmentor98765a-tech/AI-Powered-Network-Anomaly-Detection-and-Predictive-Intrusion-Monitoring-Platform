from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.core.security import decode_access_token


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        user = db.scalar(select(User).where(User.id == int(user_id)))
    except (ValueError, TypeError):
        user = None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive"
        )

    return user


def get_current_role(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Role:
    role = db.scalar(select(Role).where(Role.id == current_user.role_id))

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User role is not configured"
        )

    return role


def get_current_admin(
    current_user: User = Depends(get_current_user),
    role: Role = Depends(get_current_role)
) -> User:
    if role.name != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user