from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models import User, RevokedToken
from ..schemas import LoginRequest, TokenOut, PasswordChange, UserOut
from ..security import verify_password, create_access_token, decode_token, hash_password, password_valid
from ..dependencies import get_current_user
from ..audit import audit

router = APIRouter(prefix="/api/auth", tags=["authentication"])
limiter = Limiter(key_func=get_remote_address)
failed_attempts = {}


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    key = get_remote_address(request)
    count = failed_attempts.get(key, 0)
    if count >= 10:
        audit(db, None, "auth.login", "user", status="blocked", details={"reason": "rate_limit"})
        db.commit()
        raise HTTPException(status_code=429, detail="Too many login attempts")
    user = db.query(User).filter((User.email == payload.identifier) | (User.username == payload.identifier)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        failed_attempts[key] = count + 1
        audit(db, user.id if user else None, "auth.login", "user", user.id if user else None, "failure")
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        audit(db, user.id, "auth.login", "user", user.id, "failure", {"reason": "inactive"})
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    failed_attempts.pop(key, None)
    token = create_access_token(user.id, user.role.role_name)
    audit(db, user.id, "auth.login", "user", user.id, "success")
    db.commit()
    return {"access_token": token, "role": user.role.role_name, "user": user}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None), user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    if authorization:
        claims = decode_token(authorization[7:])
        if claims:
            db.merge(RevokedToken(jti=claims["jti"], expires_at=datetime.fromtimestamp(claims["exp"], timezone.utc)))
    audit(db, user.id, "auth.logout", "user", user.id, "success")
    db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password")
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not password_valid(payload.new_password):
        raise HTTPException(status_code=422, detail="Password must contain 8 characters with uppercase, lowercase, and a digit")
    user.password_hash = hash_password(payload.new_password)
    audit(db, user.id, "auth.password_change", "user", user.id, "success")
    db.commit()
    return {"message": "Password changed"}
