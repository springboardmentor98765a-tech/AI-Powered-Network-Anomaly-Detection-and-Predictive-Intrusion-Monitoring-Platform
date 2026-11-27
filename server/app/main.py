from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base
from app.api.routers import auth, audit_logs, teams, users, traffic, anomaly

# Create database tables automatically if not using external migrations
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NetShield AI - Module 1: User Management API",
    version="1.0.0"
)

# Enable CORS for React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update to specific frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(audit_logs.router)
app.include_router(traffic.router)
app.include_router(anomaly.router)

@app.get("/")
def root():
    return {"status": "running", "module": "Module 1 - User Management & RBAC"}