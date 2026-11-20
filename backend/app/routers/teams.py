from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_action
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Team, User
from app.schemas import TeamCreate, TeamMemberAdd, TeamOut, UserOut

router = APIRouter(prefix="/teams", tags=["Teams"])

admin_only = require_roles("administrator")
lead_or_admin = require_roles("administrator", "team_lead")


def get_team_or_404(db: Session, team_id: int) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def user_role_names(user: User) -> set[str]:
    return {r.role_name for r in user.roles}


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    data: TeamCreate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    if db.query(Team).filter(Team.team_name == data.team_name).first():
        raise HTTPException(status_code=409, detail="Team name already exists")

    team = Team(team_name=data.team_name, description=data.description)
    db.add(team)
    db.commit()
    db.refresh(team)

    log_action(db, "CREATE_TEAM", "success", actor_user_id=admin.id,
               target_type="team", target_id=team.id)
    return team


@router.get("", response_model=list[TeamOut])
def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Admins see every team. Everyone else sees only the teams they belong to.
    if "administrator" in user_role_names(current_user):
        return db.query(Team).order_by(Team.id).all()
    return current_user.teams


@router.get("/{team_id}/members", response_model=list[UserOut])
def list_team_members(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = get_team_or_404(db, team_id)

    is_admin = "administrator" in user_role_names(current_user)
    is_member = any(t.id == team.id for t in current_user.teams)
    if not (is_admin or is_member):
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action")

    return team.members


@router.post("/{team_id}/members", response_model=list[UserOut])
def add_team_member(
    team_id: int,
    data: TeamMemberAdd,
    actor: User = Depends(lead_or_admin),
    db: Session = Depends(get_db),
):
    team = get_team_or_404(db, team_id)

    # A team lead can only manage teams they belong to
    if "administrator" not in user_role_names(actor) and not any(t.id == team.id for t in actor.teams):
        raise HTTPException(status_code=403, detail="You can only manage your own teams")

    user = db.query(User).filter(User.id == data.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user in team.members:
        raise HTTPException(status_code=409, detail="User is already in this team")

    team.members.append(user)
    db.commit()
    db.refresh(team)

    log_action(db, "ADD_TEAM_MEMBER", "success", actor_user_id=actor.id,
               target_type="team", target_id=team.id, details=f"user_id={user.id}")
    return team.members


@router.delete("/{team_id}/members/{user_id}", response_model=list[UserOut])
def remove_team_member(
    team_id: int,
    user_id: int,
    actor: User = Depends(lead_or_admin),
    db: Session = Depends(get_db),
):
    team = get_team_or_404(db, team_id)

    if "administrator" not in user_role_names(actor) and not any(t.id == team.id for t in actor.teams):
        raise HTTPException(status_code=403, detail="You can only manage your own teams")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user not in team.members:
        raise HTTPException(status_code=404, detail="User is not in this team")

    team.members.remove(user)
    db.commit()
    db.refresh(team)

    log_action(db, "REMOVE_TEAM_MEMBER", "success", actor_user_id=actor.id,
               target_type="team", target_id=team.id, details=f"user_id={user.id}")
    return team.members