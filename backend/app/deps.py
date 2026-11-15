
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.services import user_service

# tokenUrl makes the "Authorize" button in Swagger call our login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)  # None if the signature is bad or the token expired
    if payload is None:
        raise error

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise error

    # Always reload from the DB: catches deactivated users and role changes immediately
    user = user_service.get_user_by_id(db, user_id)
    if user is None or user.status != "active":
        raise error
    return user


def require_roles(*allowed_roles: str):
    """Usage: Depends(require_roles("admin"))"""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        # Role comes from the database user, never from the request
        if current_user.role.role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do this",
            )
        return current_user

    return checker