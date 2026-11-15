
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.schemas.auth import Token
from app.services import auth_service

from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import ChangePassword, Token
from app.services import auth_service, user_service
from app.services import audit_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    identifier = form.username.strip().lower()  # email or username

    if auth_service.is_locked_out(identifier):
        audit_service.log_event(db, None, "login", "user", None, "failure",
                                f"locked out: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in a few minutes.",
        )

    user = auth_service.authenticate_user(db, identifier, form.password)
    if user is None:
        auth_service.record_failure(identifier)
        audit_service.log_event(db, None, "login", "user", None, "failure",
                                f"attempted: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service.clear_failures(identifier)
    audit_service.log_event(db, user.id, "login", "user", user.id)
    token = create_access_token(user_id=user.id, role=user.role.role_name)
    return Token(access_token=token)

@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.old_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    try:
        user_service.change_password(db, current_user, data.old_password, data.new_password)
    except user_service.WrongPasswordError:
        audit_service.log_event(db, current_user.id, "password_change", "user",
                                current_user.id, "failure", "wrong old password")
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    audit_service.log_event(db, current_user.id, "password_change", "user", current_user.id)

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # JWTs are stateless: this records the event, but the token stays valid until it expires.
    # The frontend must delete it. True revocation needs a token blacklist.
    audit_service.log_event(db, current_user.id, "logout", "user", current_user.id)