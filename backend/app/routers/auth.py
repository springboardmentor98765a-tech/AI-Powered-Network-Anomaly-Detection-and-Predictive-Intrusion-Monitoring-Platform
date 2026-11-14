# NetShield AI — Login routes
# Developed by Krish | SKK Projects
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import create_token, get_current_user, rate_limit_login, verify_password
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=schemas.TokenOut, dependencies=[Depends(rate_limit_login)])
def login(body: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        log_action(db, None, "login_failed", f"username={body.username}", request)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled")
    log_action(db, user, "login", "successful login", request)
    return {"access_token": create_token(user), "user": user}


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
