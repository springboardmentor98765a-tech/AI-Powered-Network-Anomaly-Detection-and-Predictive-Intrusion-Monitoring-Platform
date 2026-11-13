from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import (
    User,
    Team,
    TeamMember,
    Role,
    AuditLog
)
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamMemberAdd,
    TeamResponse,
    TeamMemberResponse
)
from app.api.deps import get_current_user, require_roles


router = APIRouter(
    prefix="/teams",
    tags=["Team Management"]
)


ADMIN = "Administrator"
LEAD = "Team Lead / Supervisor"
ANALYST = "Security Analyst"


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def load_team(db: Session, team_id: int):
    """Retrieve a team along with its lead and members."""

    team = db.scalar(
        select(Team)
        .options(
            selectinload(Team.team_lead),
            selectinload(Team.memberships)
            .selectinload(TeamMember.user)
            .selectinload(User.roles)
        )
        .where(Team.id == team_id)
    )

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found."
        )

    return team


def validate_team_lead(db: Session, user_id: int | None):
    """Check whether the selected team lead is eligible."""

    if user_id is None:
        return

    user = db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )

    if user is None or user.status != "active":
        raise HTTPException(
            status_code=400,
            detail="Invalid or inactive team lead."
        )

    has_lead_role = any(
        role.role_name == LEAD for role in user.roles
    )

    if not has_lead_role:
        raise HTTPException(
            status_code=400,
            detail="Selected user does not have the Team Lead role."
        )


def ensure_team_access(team: Team, actor: User):
    """Check whether the user may view this team."""

    roles = {role.role_name for role in actor.roles}

    is_admin = ADMIN in roles
    is_lead = LEAD in roles and team.team_lead_id == actor.id

    is_member = any(
        membership.user_id == actor.id
        for membership in team.memberships
    )

    if not (is_admin or is_lead or is_member):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this team."
        )


def ensure_team_manager(team: Team, actor: User):
    """Only administrators and the assigned team lead can manage a team."""

    roles = {role.role_name for role in actor.roles}

    is_admin = ADMIN in roles
    is_assigned_lead = (
        LEAD in roles and team.team_lead_id == actor.id
    )

    if not (is_admin or is_assigned_lead):
        raise HTTPException(
            status_code=403,
            detail="You cannot manage this team."
        )


def serialize_team(team: Team):
    """Convert a Team object into a response dictionary."""

    return {
        "id": team.id,
        "team_name": team.team_name,
        "description": team.description,
        "created_at": team.created_at,
        "created_by_id": team.created_by_id,

        "team_lead": (
            {
                "id": team.team_lead.id,
                "name": team.team_lead.name,
                "username": team.team_lead.username
            }
            if team.team_lead else None
        ),

        "members": [
            {
                "user_id": membership.user.id,
                "name": membership.user.name,
                "username": membership.user.username,
                "email": membership.user.email,
                "roles": sorted(
                    role.role_name
                    for role in membership.user.roles
                ),
                "assigned_at": membership.assigned_at
            }
            for membership in team.memberships
        ]
    }


# --------------------------------------------------
# CREATE TEAM - ADMINISTRATOR ONLY
# --------------------------------------------------

@router.post("", response_model=TeamResponse, status_code=201)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ADMIN))
):
    team_name = data.team_name.strip()

    if not team_name:
        raise HTTPException(
            status_code=400,
            detail="Team name cannot be empty."
        )

    existing_team = db.scalar(
        select(Team).where(
            func.lower(Team.team_name) == team_name.lower()
        )
    )

    if existing_team:
        raise HTTPException(
            status_code=409,
            detail="A team with this name already exists."
        )

    validate_team_lead(db, data.team_lead_id)

    team = Team(
        team_name=team_name,
        description=(
            data.description.strip()
            if data.description else None
        ),
        created_by_id=actor.id,
        team_lead_id=data.team_lead_id
    )

    db.add(team)
    db.flush()

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="TEAM_CREATED",
            target_type="Team",
            target_id=str(team.id),
            status="SUCCESS",
            details={
                "team_name": team.team_name,
                "team_lead_id": team.team_lead_id
            }
        )
    )

    db.commit()

    return serialize_team(load_team(db, team.id))


# --------------------------------------------------
# VIEW TEAMS - ROLE-BASED ACCESS
# --------------------------------------------------

@router.get("", response_model=list[TeamResponse])
def list_teams(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    roles = {role.role_name for role in actor.roles}

    query = select(Team).options(
        selectinload(Team.team_lead),
        selectinload(Team.memberships)
        .selectinload(TeamMember.user)
        .selectinload(User.roles)
    )

    if ADMIN not in roles:
        conditions = []

        if LEAD in roles:
            conditions.append(Team.team_lead_id == actor.id)

        if ANALYST in roles:
            conditions.append(
                Team.id.in_(
                    select(TeamMember.team_id).where(
                        TeamMember.user_id == actor.id
                    )
                )
            )

        if not conditions:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view teams."
            )

        query = query.where(or_(*conditions))

    teams = db.scalars(
        query.order_by(Team.id).offset(offset).limit(limit)
    ).all()

    return [serialize_team(team) for team in teams]


# --------------------------------------------------
# VIEW INDIVIDUAL TEAM
# --------------------------------------------------

@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user)
):
    team = load_team(db, team_id)

    ensure_team_access(team, actor)

    return serialize_team(team)


# --------------------------------------------------
# UPDATE TEAM DETAILS
# --------------------------------------------------

@router.patch("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user)
):
    team = load_team(db, team_id)

    ensure_team_manager(team, actor)

    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update."
        )

    if "team_lead_id" in changes:
        if ADMIN not in {role.role_name for role in actor.roles}:
            raise HTTPException(
                status_code=403,
                detail="Only an administrator can reassign a team lead."
            )

        validate_team_lead(db, changes["team_lead_id"])

    if "team_name" in changes:
        new_name = changes["team_name"].strip()

        if not new_name:
            raise HTTPException(
                status_code=400,
                detail="Team name cannot be empty."
            )

        duplicate = db.scalar(
            select(Team).where(
                func.lower(Team.team_name) == new_name.lower(),
                Team.id != team_id
            )
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A team with this name already exists."
            )

        changes["team_name"] = new_name

    if "description" in changes and changes["description"] is not None:
        changes["description"] = changes["description"].strip() or None

    for field, value in changes.items():
        setattr(team, field, value)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="TEAM_UPDATED",
            target_type="Team",
            target_id=str(team.id),
            status="SUCCESS",
            details={"changed_fields": list(changes.keys())}
        )
    )

    db.commit()

    return serialize_team(load_team(db, team_id))


# --------------------------------------------------
# ADD ANALYST TO TEAM
# --------------------------------------------------

@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=201)
def add_team_member(
    team_id: int,
    data: TeamMemberAdd,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user)
):
    team = load_team(db, team_id)

    ensure_team_manager(team, actor)

    user = db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == data.user_id)
    )

    if user is None or user.status != "active":
        raise HTTPException(
            status_code=404,
            detail="Active user not found."
        )

    has_analyst_role = any(
        role.role_name == ANALYST for role in user.roles
    )

    if not has_analyst_role:
        raise HTTPException(
            status_code=400,
            detail="Only active Security Analysts can be assigned as team members."
        )

    existing_member = db.get(
        TeamMember,
        (team_id, data.user_id)
    )

    if existing_member:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this team."
        )

    membership = TeamMember(
        team_id=team_id,
        user_id=data.user_id,
        assigned_by_id=actor.id
    )

    db.add(membership)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="TEAM_MEMBER_ADDED",
            target_type="Team",
            target_id=str(team_id),
            status="SUCCESS",
            details={"user_id": user.id}
        )
    )

    db.commit()
    db.refresh(membership)

    return {
        "user_id": user.id,
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "roles": sorted(role.role_name for role in user.roles),
        "assigned_at": membership.assigned_at
    }


# --------------------------------------------------
# REMOVE ANALYST FROM TEAM
# --------------------------------------------------

@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user)
):
    team = load_team(db, team_id)

    ensure_team_manager(team, actor)

    membership = db.get(
        TeamMember,
        (team_id, user_id)
    )

    if membership is None:
        raise HTTPException(
            status_code=404,
            detail="Team membership not found."
        )

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="TEAM_MEMBER_REMOVED",
            target_type="Team",
            target_id=str(team_id),
            status="SUCCESS",
            details={"user_id": user_id}
        )
    )

    db.delete(membership)
    db.commit()

    return {
        "message": "Team member removed successfully."
    }


# --------------------------------------------------
# DELETE TEAM - ADMINISTRATOR ONLY
# --------------------------------------------------

@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ADMIN))
):
    team = load_team(db, team_id)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="TEAM_DELETED",
            target_type="Team",
            target_id=str(team.id),
            status="SUCCESS",
            details={"team_name": team.team_name}
        )
    )

    db.delete(team)
    db.commit()

    return {
        "message": "Team deleted successfully."
    }