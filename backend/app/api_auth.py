from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .audit import log_event
from .auth_stub import authenticate_user
from .database import get_db
from .models import User
from .security import (
    COOKIE_NAME,
    COOKIE_SECURE,
    TOKEN_MINUTES,
    create_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    identifier: str
    password: str


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "roles": [role.role_name for role in user.roles],
    }


@router.post("/login")
def api_login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, payload.identifier, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    response.set_cookie(
        COOKIE_NAME,
        create_token(user.id),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=TOKEN_MINUTES * 60,
    )
    return {"user": _user_payload(user)}


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
