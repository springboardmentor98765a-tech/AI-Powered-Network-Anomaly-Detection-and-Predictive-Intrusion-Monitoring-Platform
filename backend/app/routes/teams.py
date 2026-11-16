
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Team, TeamMember, Role, AuditLog
from app.schemas.teams import TeamCreate, TeamUpdate, TeamMemberCreate
from app.utils.permissions import admin_only, admin_or_team_lead


router = APIRouter(
    prefix="/teams",
    tags=["Team Management"]
)


# Helper function to format team details
def format_team(team):

    return {
        "id": team.id,
        "team_name": team.team_name,
        "description": team.description,
        "created_by": team.created_by,
        "members": [
            {
                "id": member.user.id,
                "username": member.user.username,
                "full_name": member.user.full_name
            }
            for member in team.members
        ]
    }


# 1. CREATE TEAM
@router.post("/")
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    existing = db.query(Team).filter(
        Team.team_name == data.team_name
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Team already exists"
        )

    team = Team(
        team_name=data.team_name,
        description=data.description,
        created_by=current_admin.id
    )

    db.add(team)
    db.flush()

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="TEAM_CREATED",
        target_type="TEAM",
        target_id=team.id,
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(team)

    return format_team(team)


# 2. VIEW ALL TEAMS
@router.get("/")
def get_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_team_lead)
):

    query = db.query(Team)

    # Team Leads can only see teams they belong to
    is_admin = any(
        item.role.role_name == "Administrator"
        for item in current_user.user_roles
    )

    if not is_admin:
        query = query.join(TeamMember).filter(
            TeamMember.user_id == current_user.id
        )

    teams = query.distinct().all()

    return [
        format_team(team)
        for team in teams
    ]


# 3. VIEW TEAM DETAILS
@router.get("/{team_id}")
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_team_lead)
):

    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    is_admin = any(
        item.role.role_name == "Administrator"
        for item in current_user.user_roles
    )

    if not is_admin:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id
        ).first()

        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You cannot access this team"
            )

    return format_team(team)


# 4. UPDATE TEAM
@router.put("/{team_id}")
def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No changes provided"
        )

    if "team_name" in updates:
        duplicate = db.query(Team).filter(
            Team.team_name == updates["team_name"],
            Team.id != team_id
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Team name already exists"
            )

    for field, value in updates.items():
        setattr(team, field, value)

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="TEAM_UPDATED",
        target_type="TEAM",
        target_id=team.id,
        status="SUCCESS"
    ))

    db.commit()
    db.refresh(team)

    return format_team(team)



# 5. ASSIGN MEMBER TO TEAM
@router.post("/{team_id}/members")
def assign_member(
    team_id: int,
    data: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    # Check whether team exists
    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    # Check whether user exists and is active
    user = db.query(User).filter(
        User.id == data.user_id,
        User.is_active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Active user not found"
        )

    # Allow Security Analysts and Team Leads
    allowed_roles = [
        "Security Analyst",
        "Team Lead / Supervisor"
    ]

    has_allowed_role = any(
        item.role.role_name in allowed_roles
        for item in user.user_roles
    )

    if not has_allowed_role:
        raise HTTPException(
            status_code=400,
            detail="Only Security Analysts and Team Leads can join teams"
        )

    # Check existing membership
    existing = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="User is already assigned to this team"
        )

    try:
        # Add member
        db.add(TeamMember(
            team_id=team_id,
            user_id=user.id
        ))

        # Record audit log
        db.add(AuditLog(
            actor_user_id=current_admin.id,
            action="TEAM_MEMBER_ADDED",
            target_type="TEAM",
            target_id=team.id,
            status="SUCCESS",
            details={"user_id": user.id}
        ))

        db.commit()

        return {
            "message": "Team member assigned successfully",
            "team_id": team_id,
            "user_id": user.id
        }

    except Exception:
        db.rollback()
        raise


# 6. REMOVE MEMBER FROM TEAM
@router.delete("/{team_id}/members/{user_id}")
def remove_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):

    membership = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Team membership not found"
        )

    db.add(AuditLog(
        actor_user_id=current_admin.id,
        action="TEAM_MEMBER_REMOVED",
        target_type="TEAM",
        target_id=team_id,
        status="SUCCESS",
        details={"user_id": user_id}
    ))

    db.delete(membership)
    db.commit()

    return {
        "message": "Team member removed successfully"
    }
