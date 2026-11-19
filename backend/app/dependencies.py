from datetime import datetime, timezone
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from .database import get_db
from .models import RevokedToken, User
from .security import decode_token
from .permissions import has_permission


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization[7:]
    claims = decode_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    jti = claims.get("jti")
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if revoked:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    user = db.query(User).filter(User.id == int(claims["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive or unavailable account")
    return user


def require_permission(permission: str):
    def dependency(user: User = Depends(get_current_user)):
        if not has_permission(user.role.role_name, permission):
            raise HTTPException(status_code=403, detail="Permission denied")
        return user
    return dependency
