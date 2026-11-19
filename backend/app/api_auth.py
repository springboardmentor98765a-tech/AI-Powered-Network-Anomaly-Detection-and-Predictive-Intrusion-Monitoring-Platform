import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .audit import log_event
from .auth_stub import authenticate_user
from .database import get_db
from .models import Role, User
from .permissions import ANALYST, LEAD
from .security import (
    COOKIE_NAME,
    COOKIE_SECURE,
    TOKEN_MINUTES,
    create_token,
    get_current_user,
    hash_password,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    identifier: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str
    role: str

    class Config:
        extra = "forbid"


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "roles": [role.role_name for role in user.roles],
    }


def _set_session_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user.id),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=TOKEN_MINUTES * 60,
    )


@router.post("/login")
def api_login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, payload.identifier, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    _set_session_cookie(response, user)
    return {"user": _user_payload(user)}


@router.post("/register", status_code=201)
def api_register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    email = payload.email.strip().lower()
    if not name or len(name) > 100:
        raise HTTPException(status_code=400, detail="Name must be between 1 and 100 characters.")
    if (len(email) > 255
            or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(payload.password) < 8 or len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
        )
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if payload.role not in {ANALYST, LEAD}:
        raise HTTPException(
            status_code=400,
            detail="Choose Security Analyst or Team Lead / Supervisor.",
        )
    selected_role = db.scalar(select(Role).where(Role.role_name == payload.role))
    if selected_role is None:
        raise HTTPException(status_code=500, detail="Registration is not configured.")

    user = User(name=name, email=email, password_hash=hash_password(payload.password))
    user.roles.append(selected_role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(User.id).where(func.lower(User.email) == email)):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )
        raise
    db.refresh(user)
    log_event(db, user.id, "user.create", "success", "user", user.id, "self-registration")
    signed_in_user = authenticate_user(db, email, payload.password)
    if signed_in_user is None:
        raise HTTPException(
            status_code=500,
            detail="Account was created but automatic sign-in failed. Please sign in.",
        )
    _set_session_cookie(response, signed_in_user)
    return {"user": _user_payload(signed_in_user)}


@router.get("/me")
def current_user(user: User = Depends(get_current_user)):
    return {"user": _user_payload(user)}


@router.post("/logout")
def api_logout(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log_event(db, user.id, "logout", "success", "user", user.id)
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}
