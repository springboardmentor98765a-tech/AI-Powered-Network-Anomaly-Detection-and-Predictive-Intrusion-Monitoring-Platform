from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .database import Base, engine, get_db
from .models import User, Role, Team, AuditLog
from .dependencies import get_current_user
from .routers import auth, users, teams, audit
from .config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Module 1 - User Management", version="1.0.0")
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(audit.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/dashboard")
def dashboard(db=Depends(get_db), user: User=Depends(get_current_user)):
    result = {"role": user.role.role_name}
    if user.role.role_name == "Administrator":
        result.update({
            "total_users": db.query(User).count(),
            "active_users": db.query(User).filter(User.is_active == True).count(),
            "inactive_users": db.query(User).filter(User.is_active == False).count(),
            "total_teams": db.query(Team).count(),
            "recent_activity": db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all(),
        })
    elif user.role.role_name == "Team Lead / Supervisor":
        from .models import TeamMember
        memberships = db.query(TeamMember).filter(TeamMember.user_id == user.id).all()
        result.update({"assigned_team_ids": [m.team_id for m in memberships],
                       "assigned_team_count": len(memberships),
                       "recent_activity": []})
    else:
        result.update({"assigned_monitoring": "Security monitoring features are available in later modules.",
                       "recent_activity": []})
    return result


@app.get("/api/roles")
def roles(db=Depends(get_db), user: User=Depends(get_current_user)):
    if user.role.role_name != "Administrator":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Permission denied")
    return db.query(Role).all()
