from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Role
from app.schemas import LoginRequest, TokenResponse, ChangePasswordRequest, RegisterRequest, UserResponse
from app.security import verify_password, hash_password, create_access_token
from app.api.dependencies import get_current_user
from app.api.audit import log_audit_event
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    
    # Generic non-revealing error message for both bad email or bad password
    error_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password"
    )

    if not user or not verify_password(credentials.password, user.password_hash):
        log_audit_event(db, actor_user_id=user.id if user else None, action="LOGIN_FAILED", target_type="AUTH", status="FAILURE", details={"email": credentials.email})
        raise error_exc
    
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # Issue JWT token
    access_token = create_access_token(data={"sub": user.id})
    access_token = create_access_token(data={"sub": str(user.id)})
    log_audit_event(db, actor_user_id=user.id, action="LOGIN_SUCCESS", target_type="AUTH", status="SUCCESS")
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_audit_event(db, actor_user_id=current_user.id, action="LOGOUT", target_type="AUTH", status="SUCCESS")
    return {"message": "Successfully logged out"}

@router.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect existing password")
    
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    log_audit_event(db, actor_user_id=current_user.id, action="PASSWORD_CHANGED", target_type="USER", target_id=current_user.id, status="SUCCESS")
    return {"message": "Password updated successfully"}

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Restrict self-registration to Analyst and Team Lead only
    allowed_roles = ["Analyst", "Team Lead"]
    if body.role_name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is only permitted for Analyst or Team Lead roles"
        )

    # 2. Check for duplicate email
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # 3. Validate role exists in database
    role = db.query(Role).filter(Role.role_name == body.role_name).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{body.role_name}' not found in system"
        )

    # 4. Create user and assign selected role
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        status="active"
    )
    user.roles = [role]

    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db,
        actor_user_id=user.id,
        action="USER_SELF_REGISTERED",
        target_type="USER",
        target_id=user.id,
        status="SUCCESS",
        details={"email": user.email, "role": body.role_name}
    )
    return user