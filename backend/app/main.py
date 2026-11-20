
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes.auth import router as auth_router, limiter
from app.api.routes.users import router as users_router
from app.api.routes.audit import router as audit_router
from app.api.routes.teams import router as teams_router
from app.api.routes.team_members import router as team_members_router
from app.api.routes.network import router as network_router

from app.core.dependencies import get_current_admin
from app.models.user import User


app = FastAPI(
    title="NetShield AI",
    description="Network Anomaly Detection and Predictive Intrusion Monitoring Platform",
    version="1.0.0",
)

# Configure rate limiting.
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)

# Configure frontend communication.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to NetShield AI",
        "module": "User Management",
        "status": "Backend is running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "NetShield AI",
    }


# Register application routes.
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(audit_router)
app.include_router(teams_router)
app.include_router(team_members_router)
app.include_router(network_router)

@app.get("/admin/test", tags=["Admin"])
def admin_test(
    current_user: User = Depends(get_current_admin)
):
    return {
        "message": "Admin access granted!",
        "admin_name": current_user.full_name,
        "admin_email": current_user.email,
        "role": "Admin"
    }
