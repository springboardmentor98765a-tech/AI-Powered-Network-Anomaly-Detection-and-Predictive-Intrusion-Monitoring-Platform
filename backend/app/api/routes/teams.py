from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import (
    get_current_admin,
    get_current_user,
    get_current_role
)
from app.models.user import User
from app.models.role import Role
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.team import TeamCreate, TeamUpdate, TeamResponse
from app.services.audit import create_audit_log


router = APIRouter(prefix="/teams", tags=["Team Management"])


# Admin: all teams.
# Analyst: only assigned teams.
# Viewer: all active teams, read-only.
@router.get("/", response_model=list[TeamResponse])
def get_all_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: Role = Depends(get_current_role)
):
    query = select(Team).order_by(Team.id)

    if role.name == "Analyst":
        query = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TeamMember.user_id == current_user.id,
                Team.is_active.is_(True)
            )
            .order_by(Team.id)
        )

    elif role.name == "Viewer":
        query = query.where(Team.is_active.is_(True))

    elif role.name != "Admin":
        raise HTTPException(
            status_code=403,
            detail="Role is not permitted to view teams"
        )

    return db.scalars(query).all()


# Create a new team - Admin only
@router.post(
    "/",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED
)
def create_team(
    team_data: TeamCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    team_name = team_data.name.strip()

    existing_team = db.scalar(
        select(Team).where(Team.name == team_name)
    )

    if existing_team:
        raise HTTPException(
            status_code=409,
            detail="A team with this name already exists"
        )

    new_team = Team(
        name=team_name,
        description=team_data.description,
        is_active=True
    )

    db.add(new_team)
    db.commit()
    db.refresh(new_team)

    create_audit_log(
        db=db,
        action="CREATE",
        entity_type="TEAM",
        user_id=current_admin.id,
        entity_id=str(new_team.id),
        description=f"Admin created team {new_team.name}"
    )

    return new_team


# Update a team - Admin only
@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    team_data: TeamUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    team = db.scalar(
        select(Team).where(Team.id == team_id)
    )

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    team_name = team_data.name.strip()

    duplicate_team = db.scalar(
        select(Team).where(
            Team.name == team_name,
            Team.id != team_id
        )
    )

    if duplicate_team:
        raise HTTPException(
            status_code=409,
            detail="Another team already uses this name"
        )

    team.name = team_name
    team.description = team_data.description
    team.is_active = team_data.is_active

    db.commit()
    db.refresh(team)

    create_audit_log(
        db=db,
        action="UPDATE",
        entity_type="TEAM",
        user_id=current_admin.id,
        entity_id=str(team.id),
        description=f"Admin updated team {team.name}"
    )

    return team


# Delete a team - Admin only
@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    team = db.scalar(
        select(Team).where(Team.id == team_id)
    )

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    team_name = team.name

    db.delete(team)
    db.commit()

    create_audit_log(
        db=db,
        action="DELETE",
        entity_type="TEAM",
        user_id=current_admin.id,
        entity_id=str(team_id),
        description=f"Admin deleted team {team_name}"
    )

    return {
        "message": "Team deleted successfully",
        "team_id": team_id
    }