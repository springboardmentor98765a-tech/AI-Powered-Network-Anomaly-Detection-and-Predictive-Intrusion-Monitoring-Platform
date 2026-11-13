from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.team import Team
from app.models.audit import AuditAction, AuditStatus
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamMemberAdd,
)
from app.schemas.user import UserSimpleResponse
from app.api.deps import (
    get_current_user,
    require_roles,
    get_client_ip,
    log_audit,
)

router = APIRouter(prefix="/teams", tags=["Team Management"])

def serialize_team(team: Team) -> TeamResponse:
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        lead_id=team.lead_id,
        lead_name=team.lead.full_name if team.lead else None,
        member_count=len(team.members),
        members=[
            UserSimpleResponse(
                id=m.id,
                username=m.username,
                email=m.email,
                full_name=m.full_name,
                role=m.role,
                is_active=m.is_active,
                team_id=m.team_id,
            )
            for m in team.members
        ],
        created_at=team.created_at,
        updated_at=team.updated_at,
    )

@router.get("", response_model=list[TeamResponse])
def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List teams based on user role permissions:
    - Administrator: all teams.
    - Team Lead: teams they lead or belong to.
    - Security Analyst: their assigned team.
    """
    if current_user.role == UserRole.ADMIN:
        teams = db.query(Team).order_by(Team.name.asc()).all()
    elif current_user.role == UserRole.TEAM_LEAD:
        teams = (
            db.query(Team)
            .filter((Team.lead_id == current_user.id) | (Team.id == current_user.team_id))
            .order_by(Team.name.asc())
            .all()
        )
    else:
        # Analyst
        if current_user.team_id:
            teams = db.query(Team).filter(Team.id == current_user.team_id).all()
        else:
            teams = []

    return [serialize_team(t) for t in teams]

@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in: TeamCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Create a new SOC security team. Administrator only.
    """
    ip = get_client_ip(request)

    # Check unique name
    if db.query(Team).filter(Team.name == team_in.name).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A team named '{team_in.name}' already exists.",
        )

    # Check lead if provided
    lead = None
    if team_in.lead_id:
        lead = db.query(User).filter(User.id == team_in.lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Selected team lead not found.")
        if not lead.is_active:
            raise HTTPException(status_code=400, detail="Cannot assign a deactivated user as team lead.")

    new_team = Team(
        name=team_in.name,
        description=team_in.description,
        lead_id=team_in.lead_id,
    )
    db.add(new_team)
    db.commit()
    db.refresh(new_team)

    # If lead was assigned, automatically assign their team_id as well
    if lead and lead.team_id != new_team.id:
        lead.team_id = new_team.id
        db.commit()
        db.refresh(new_team)

    log_audit(
        db=db,
        action=AuditAction.TEAM_CREATE,
        target_type="TEAM",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(new_team.id),
        details={"name": new_team.name, "lead_id": new_team.lead_id},
        ip_address=ip,
    )

    return serialize_team(new_team)

@router.get("/{team_id}", response_model=TeamResponse)
def get_team_by_id(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get detailed team info and members.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    if current_user.role == UserRole.ANALYST and current_user.team_id != team.id:
        raise HTTPException(status_code=403, detail="You can only view your own assigned team.")

    return serialize_team(team)

@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    team_in: TeamUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update team name, description, or lead.
    Allowed for Administrator or the assigned Team Lead of this team.
    """
    ip = get_client_ip(request)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    is_admin = current_user.role == UserRole.ADMIN
    is_lead = (current_user.role == UserRole.TEAM_LEAD) and (team.lead_id == current_user.id)

    if not (is_admin or is_lead):
        raise HTTPException(status_code=403, detail="Only an Administrator or the Team Lead can update this team.")

    changes = {}

    if team_in.name and team_in.name != team.name:
        existing = db.query(Team).filter(Team.name == team_in.name).first()
        if existing and existing.id != team.id:
            raise HTTPException(status_code=400, detail="Team name already in use.")
        changes["name"] = {"old": team.name, "new": team_in.name}
        team.name = team_in.name

    if team_in.description is not None:
        changes["description"] = team_in.description
        team.description = team_in.description

    # Only Admin can reassign team lead
    if team_in.lead_id is not None and is_admin:
        if team_in.lead_id == 0:
            team.lead_id = None
            changes["lead_id"] = "removed"
        else:
            lead = db.query(User).filter(User.id == team_in.lead_id).first()
            if not lead:
                raise HTTPException(status_code=404, detail="Lead user not found.")
            if not lead.is_active:
                raise HTTPException(status_code=400, detail="Cannot assign deactivated user as lead.")
            changes["lead_id"] = {"old": team.lead_id, "new": team_in.lead_id}
            team.lead_id = team_in.lead_id
            lead.team_id = team.id

    db.commit()
    db.refresh(team)

    log_audit(
        db=db,
        action=AuditAction.TEAM_UPDATE,
        target_type="TEAM",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(team.id),
        details={"changes": changes},
        ip_address=ip,
    )

    return serialize_team(team)

@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Delete a team. Administrator only.
    Members are unassigned safely without deleting their user accounts.
    """
    ip = get_client_ip(request)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    team_name = team.name
    # Unassign members
    for member in team.members:
        member.team_id = None

    db.delete(team)
    db.commit()

    log_audit(
        db=db,
        action=AuditAction.TEAM_DELETE,
        target_type="TEAM",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(team_id),
        details={"deleted_team_name": team_name},
        ip_address=ip,
    )

    return {"message": f"Team '{team_name}' deleted successfully."}

@router.post("/{team_id}/members")
def add_team_member(
    team_id: int,
    data: TeamMemberAdd,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add an analyst or member to the team.
    Allowed for Administrator or the assigned Team Lead.
    """
    ip = get_client_ip(request)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    is_admin = current_user.role == UserRole.ADMIN
    is_lead = (current_user.role == UserRole.TEAM_LEAD) and (team.lead_id == current_user.id)
    if not (is_admin or is_lead):
        raise HTTPException(status_code=403, detail="Permission denied to add members to this team.")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign a deactivated user to a team.")

    if user.team_id == team.id:
        raise HTTPException(status_code=400, detail="User is already a member of this team.")

    old_team_id = user.team_id
    user.team_id = team.id
    db.commit()
    db.refresh(team)

    log_audit(
        db=db,
        action=AuditAction.TEAM_MEMBER_ADD,
        target_type="TEAM",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(team.id),
        details={
            "added_user_id": user.id,
            "added_username": user.username,
            "team_name": team.name,
            "previous_team_id": old_team_id,
        },
        ip_address=ip,
    )

    return serialize_team(team)

@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a member from the team.
    Allowed for Administrator or the assigned Team Lead.
    """
    ip = get_client_ip(request)
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    is_admin = current_user.role == UserRole.ADMIN
    is_lead = (current_user.role == UserRole.TEAM_LEAD) and (team.lead_id == current_user.id)
    if not (is_admin or is_lead):
        raise HTTPException(status_code=403, detail="Permission denied to modify members of this team.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.team_id != team.id:
        raise HTTPException(status_code=400, detail="User is not currently a member of this team.")

    user.team_id = None
    db.commit()
    db.refresh(team)

    log_audit(
        db=db,
        action=AuditAction.TEAM_MEMBER_REMOVE,
        target_type="TEAM",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(team.id),
        details={
            "removed_user_id": user.id,
            "removed_username": user.username,
            "team_name": team.name,
        },
        ip_address=ip,
    )

    return {"message": f"User '{user.username}' removed from team '{team.name}'."}
