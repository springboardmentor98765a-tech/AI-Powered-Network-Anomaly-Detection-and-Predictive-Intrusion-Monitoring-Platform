from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.auth import router as auth_router

from app.api.users import router as users_router
from app.api.roles import router as roles_router
from app.api.teams import router as teams_router
from app.api.audit import router as audit_router

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Network Anomaly Detection and Threat Monitoring Platform",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    auth_router,
    prefix=f"/api/{settings.API_VERSION}"
)

app.include_router(
    users_router,
    prefix=f"/api/{settings.API_VERSION}"
)

app.include_router(
    roles_router,
    prefix=f"/api/{settings.API_VERSION}"
)

app.include_router(
    teams_router,
    prefix=f"/api/{settings.API_VERSION}"
)

app.include_router(
    audit_router,
    prefix=f"/api/{settings.API_VERSION}"
)

@app.get("/")
def root():
    return {
        "message": "Welcome to NetShield AI",
        "status": "running"
    }


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "NetShield AI Backend"
    }