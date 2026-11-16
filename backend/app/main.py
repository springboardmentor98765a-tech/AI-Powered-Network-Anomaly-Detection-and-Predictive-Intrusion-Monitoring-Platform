
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import engine, Base
from app import models
from app.routes import auth, rbac, users, teams, audit, roles, dashboard
from app.utils.rate_limit import limiter


# Create database tables
Base.metadata.create_all(bind=engine)


# Initialize FastAPI
app = FastAPI(
    title="Network Anomaly Detection Platform",
    description="User Management Module",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Configure rate limiting
app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)


# Register authentication routes
app.include_router(rbac.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(audit.router)
app.include_router(roles.router)
app.include_router(dashboard.router)


@app.get("/")
def home():
    return {
        "message": "Network Anomaly Detection Platform is running!",
        "module": "User Management"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected"
    }




