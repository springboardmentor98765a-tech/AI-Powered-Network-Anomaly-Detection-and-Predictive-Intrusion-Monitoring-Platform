
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_roles
from app.models.team import Team
from app.models.user import User
from app.schemas.team import (
    MemberAdd,
    TeamCreate,
    TeamDetail,
    TeamLeadUpdate,
    TeamOut,
    TeamUpdate,
)
from app.services import audit_service, team_service

router = APIRouter(prefix="/teams", tags=["teams"])

admin_only = require_roles("admin")

# Service error -> (HTTP status, message). One place to change a message.
ERROR_MAP = {
    team_service.DuplicateTeamNameError: (409, "Team name already exists"),
    team_service.UserNotFoundError: (404, "User not found"),
    team_service.InactiveUserError: (400, "User is inactive"),
    team_service.InvalidLeadError: (400, "Lead must be an active user with the team_lead role"),
    team_service.AlreadyMemberError: (409, "User is already a member of this team"),
    team_service.NotMemberError: (404, "User is not a member of this team"),
}


def _http_error(exc: team_service.TeamError) -> HTTPException:
    code, message = ERROR_MAP[type(exc)]
    return HTTPException(status_code=code, detail=message)


def _get_team_or_404(db: Session, team_id: int) -> Team:
    team = team_service.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def _require_view(db: Session, team: Team, user: User) -> None:
    if not team_service.can_view_team(db, team, user):
        raise HTTPException(status_code=403, detail="You do not have permission to view this team")


def _require_manage(team: Team, user: User) -> None:
    if not team_service.can_manage_team(team, user):
        raise HTTPException(status_code=403, detail="You do not have permission to manage this team")


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    data: TeamCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)
):
    try:
        team = team_service.create_team(db, data)
    except team_service.TeamError as exc:
        raise _http_error(exc)
    audit_service.log_event(db, admin.id, "team_create", "team", team.id,
                            details=f"team: {team.team_name}")
    return team


@router.get("", response_model=list[TeamOut])
def list_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # The service decides what this user may see
    return team_service.list_teams(db, current_user, skip, limit)


@router.get("/{team_id}", response_model=TeamDetail)
def read_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team_or_404(db, team_id)
    _require_view(db, team, current_user)
    return team


@router.patch("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team_or_404(db, team_id)
    _require_manage(team, current_user)
    try:
        changes = team_service.update_team(db, team, data)
    except team_service.TeamError as exc:
        raise _http_error(exc)
    if changes:
        audit_service.log_event(db, current_user.id, "team_update", "team", team.id,
                                details="; ".join(changes))
    return team


@router.patch("/{team_id}/lead", response_model=TeamOut)
def change_lead(
    team_id: int,
    data: TeamLeadUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    team = _get_team_or_404(db, team_id)
    try:
        old_lead_id = team_service.set_lead(db, team, data.lead_user_id)
    except team_service.TeamError as exc:
        raise _http_error(exc)
    audit_service.log_event(db, admin.id, "team_lead_change", "team", team.id,
                            details=f"lead user id: {old_lead_id} -> {data.lead_user_id}")
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)
):
    team = _get_team_or_404(db, team_id)
    team_name = team.team_name  # read it before the row is gone
    team_service.delete_team(db, team)
    audit_service.log_event(db, admin.id, "team_delete", "team", team_id,
                            details=f"team: {team_name}")


@router.post("/{team_id}/members", response_model=TeamDetail, status_code=status.HTTP_201_CREATED)
def add_member(
    team_id: int,
    data: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team_or_404(db, team_id)
    _require_manage(team, current_user)
    try:
        team_service.add_member(db, team, data.user_id)
    except team_service.TeamError as exc:
        raise _http_error(exc)
    audit_service.log_event(db, current_user.id, "team_member_add", "team", team.id,
                            details=f"user id: {data.user_id}")
    return team


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team_or_404(db, team_id)
    _require_manage(team, current_user)
    try:
        team_service.remove_member(db, team, user_id)
    except team_service.TeamError as exc:
        raise _http_error(exc)
    audit_service.log_event(db, current_user.id, "team_member_remove", "team", team.id,
                            details=f"user id: {user_id}")