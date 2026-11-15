from contextlib import asynccontextmanager
from urllib.parse import urlencode
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

from .config import settings
from .database import Base, engine, get_db
from .models import User, Role
from .schemas import RegisterRequest, LoginRequest, UserResponse
from .security import hash_password, verify_password, create_access_token, decode_access_token

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="NetShield AI Authentication API", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret, same_site="lax", https_only=False)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth = OAuth()
if settings.google_client_id and settings.google_client_secret:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

def set_session_cookie(response: Response, user: User):
    token = create_access_token(str(user.id))
    response.set_cookie(
        key="netshield_access",
        value=token,
        httponly=True,
        secure=False,  # Set True behind HTTPS in production.
        samesite="lax",
        max_age=settings.access_token_minutes * 60,
        path="/",
    )

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("netshield_access")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    return user

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.role == Role.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="Administrator accounts require an authorized setup process.")
    if data.role == Role.ENTERPRISE and not data.organization_name:
        raise HTTPException(status_code=400, detail="Organization name is required for Enterprise accounts.")
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Unable to create account with those details.")
    user = User(
        full_name=data.full_name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
        organization_name=data.organization_name,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    # Keep the error deliberately generic; never reveal which credential was wrong.
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is unavailable. Contact your administrator.")
    set_session_cookie(response, user)
    return {"message": "Login successful."}

@app.get("/auth/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return user

@app.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("netshield_access", path="/", httponly=True, samesite="lax")
    return {"message": "Logged out."}

@app.get("/auth/google")
async def google_login(request: Request):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google authentication is not configured.")
    redirect_uri = f"{settings.backend_url}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        info = token.get("userinfo")
        if not info:
            info = await oauth.google.parse_id_token(request, token)
        email = (info.get("email") or "").lower()
        name = info.get("name") or email.split("@")[0]
        if not email or not info.get("email_verified"):
            raise HTTPException(status_code=400, detail="Google account email could not be verified.")
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            # New Google users get the least-privileged default role.
            user = User(
                full_name=name,
                email=email,
                password_hash=None,
                role=Role.SECURITY_ANALYST,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        if not user.is_active:
            raise HTTPException(status_code=403, detail="This account is unavailable.")
        response = RedirectResponse(settings.frontend_url)
        set_session_cookie(response, user)
        return response
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Google authentication could not be completed.")
