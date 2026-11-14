"""MINIMAL login/logout so the dashboard can run on its own.
Replace this file (and keep `get_current_user` in security.py) when the real
authentication module is built."""
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .audit import log_event
from .dashboard import templates
from .database import get_db
from .models import User, utcnow
from .security import (COOKIE_NAME, COOKIE_SECURE, TOKEN_MINUTES, create_token,
                       get_current_user, verify_password)

router = APIRouter()


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    identifier = identifier.strip()
    user = db.scalar(select(User).where(
        or_(func.lower(User.email) == identifier.lower(),
            func.lower(User.name) == identifier.lower())
    )) if identifier else None
    ok = bool(user and user.status == "active" and verify_password(password, user.password_hash))
    if not ok:
        log_event(db, user.id if user else None, "login", "failure")
        return None

    user.last_login_at = utcnow()
    log_event(db, user.id, "login", "success", "user", user.id)
    return user


@router.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"error": None})


@router.post("/login")
def login(request: Request, password: str = Form(...), username: str = Form(""),
          email: str = Form(""),
          db: Session = Depends(get_db)):
    user = authenticate_user(db, username or email, password)
    if user is None:
        return templates.TemplateResponse(
            request, "login.html", {"error": "Invalid credentials."}, status_code=401)

    resp = RedirectResponse("/dashboard", status_code=303)
    resp.set_cookie(COOKIE_NAME, create_token(user.id), httponly=True, samesite="lax",
                    secure=COOKIE_SECURE, max_age=TOKEN_MINUTES * 60)
    return resp


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_event(db, user.id, "logout", "success", "user", user.id)
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp
