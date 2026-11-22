
import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import (
    create_token,
    get_current_user,
    hash_password,
    record_failed_login,
    rate_limit_login,
    rate_limit_registration,
    verify_password,
)
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def username_from_email(email: str, db: Session) -> str:
    """Generate a unique username from the email address."""

    local_part = email.split("@", 1)[0].lower()
    base = re.sub(r"[^a-z0-9_]", "", local_part)[:42] or "user"

    candidate = base
    suffix = 2

    while db.query(models.User.id).filter(
        models.User.username == candidate
    ).first():
        candidate = f"{base[:45]}{suffix}"
        suffix += 1

    return candidate


@router.post(
    "/register",
    response_model=schemas.RegistrationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_registration)],
)
def register(
    body: schemas.RegistrationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public registration.

    A new account is created as inactive and pending.
    The requested role is not automatically granted.
    Only an administrator can approve and assign the actual role.
    """

    email = body.email.strip().lower()
    full_name = body.full_name.strip()

    existing = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    username = username_from_email(email, db)

    user = models.User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password(body.password),

        # The actual account role is not granted during registration.
        role="viewer",

        requested_role=body.requested_role,
        approval_status="pending",
        is_active=False,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already registered.",
        )

    log_action(
        db,
        user,
        "registration_requested",
        f"Requested role: {body.requested_role}",
        request,
    )

    return {
        "message": (
            "Your account request has been submitted. "
            "Please wait for administrator approval."
        ),
        "approval_status": "pending",
    }


@router.post(
    "/login",
    response_model=schemas.TokenOut,
    dependencies=[Depends(rate_limit_login)],
)
def login(
    body: schemas.LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Allow authentication using either username or email."""

    identifier = body.username.strip()

    user = db.query(models.User).filter(
        or_(
            models.User.username == identifier,
            models.User.email == identifier.lower(),
        )
    ).first()

    if not user or not verify_password(
        body.password,
        user.hashed_password,
    ):
        record_failed_login(request)
        log_action(
            db,
            None,
            "login_failed",
            "Invalid login credentials",
            request,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password.",
        )

    if user.approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is awaiting administrator approval.",
        )

    if user.approval_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration was not approved.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    log_action(
        db,
        user,
        "login",
        "Successful login",
        request,
    )

    return {
        "access_token": create_token(user),
        "user": user,
    }


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
