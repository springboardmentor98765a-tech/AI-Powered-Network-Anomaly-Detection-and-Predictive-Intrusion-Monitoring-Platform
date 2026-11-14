
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
from app.schemas.team_member import (
    TeamMemberCreate,
    TeamMemberResponse
)
from app.services.audit import create_audit_log


router = APIRouter(prefix="/team-members", tags=["Team Members"])


# Add a user to a team - Admin only
@router.post(
    "/",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED
)
def add_team_member(
    member_data: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.get(User, member_data.user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    team = db.get(Team, member_data.team_id)

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot add an inactive user"
        )

    if not team.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot add members to an inactive team"
        )

    existing_member = db.scalar(
        select(TeamMember).where(
            TeamMember.user_id == member_data.user_id,
            TeamMember.team_id == member_data.team_id
        )
    )

    if existing_member:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this team"
        )

    new_member = TeamMember(
        user_id=member_data.user_id,
        team_id=member_data.team_id
    )

    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    create_audit_log(
        db=db,
        action="ADD_MEMBER",
        entity_type="TEAM",
        user_id=current_admin.id,
        entity_id=str(team.id),
        description=f"Admin added user {user.email} to team {team.name}"
    )

    return new_member


# Admin and Viewer can read team memberships.
# Analyst can read memberships only for assigned teams.
@router.get(
    "/{team_id}",
    response_model=list[TeamMemberResponse]
)
def get_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: Role = Depends(get_current_role)
):
    team = db.get(Team, team_id)

    if team is None or not team.is_active:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    if role.name == "Analyst":
        assignment = db.scalar(
            select(TeamMember.id).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == current_user.id
            )
        )

        if assignment is None:
            raise HTTPException(
                status_code=403,
                detail="You are not assigned to this team"
            )

    elif role.name not in ("Admin", "Viewer"):
        raise HTTPException(
            status_code=403,
            detail="Role is not permitted to view team members"
        )

    # Include user name and email in the membership response.
    results = db.execute(
        select(
            TeamMember,
            User.full_name,
            User.email
        )
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.id)
    ).all()

    return [
        {
            "id": membership.id,
            "user_id": membership.user_id,
            "team_id": membership.team_id,
            "joined_at": membership.joined_at,
            "user_full_name": full_name,
            "user_email": email
        }
        for membership, full_name, email in results
    ]


# Remove a user from a team - Admin only
@router.delete("/{team_id}/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    member = db.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        )
    )

    if member is None:
        raise HTTPException(
            status_code=404,
            detail="Team membership not found"
        )

    db.delete(member)
    db.commit()

    create_audit_log(
        db=db,
        action="REMOVE_MEMBER",
        entity_type="TEAM",
        user_id=current_admin.id,
        entity_id=str(team_id),
        description=f"Admin removed user {user_id} from team {team_id}"
    )

    return {
        "message": "Team member removed successfully",
        "team_id": team_id,
        "user_id": user_id
    }
