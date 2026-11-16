
from fastapi import APIRouter, Depends

from app.models import User
from app.utils.permissions import (
    admin_only,
    analyst_only,
    team_lead_only
)


router = APIRouter(
    prefix="/rbac",
    tags=["Role-Based Access Control"]
)


# Administrator dashboard
@router.get("/admin")
def admin_dashboard(
    current_user: User = Depends(admin_only)
):
    return {
        "message": "Welcome to the Administrator Dashboard",
        "user": current_user.username,
        "permissions": [
            "Manage users",
            "Manage roles",
            "Manage teams",
            "View audit logs",
            "Manage platform settings"
        ]
    }


# Security Analyst dashboard
@router.get("/analyst")
def analyst_dashboard(
    current_user: User = Depends(analyst_only)
):
    return {
        "message": "Welcome to the Security Analyst Dashboard",
        "user": current_user.username,
        "permissions": [
            "View network activity",
            "Review alerts",
            "Investigate suspicious events"
        ]
    }


# Team Lead dashboard
@router.get("/team-lead")
def team_lead_dashboard(
    current_user: User = Depends(team_lead_only)
):
    return {
        "message": "Welcome to the Team Lead Dashboard",
        "user": current_user.username,
        "permissions": [
            "View team dashboards",
            "View assigned analysts",
            "Oversee team incidents"
        ]
    }
