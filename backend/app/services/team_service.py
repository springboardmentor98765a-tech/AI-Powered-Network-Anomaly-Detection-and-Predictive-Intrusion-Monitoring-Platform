
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.team import TeamCreate, TeamUpdate


# ---- Errors (the router turns these into HTTP status codes) ----
class TeamError(Exception):
    pass


class DuplicateTeamNameError(TeamError):
    pass


class UserNotFoundError(TeamError):
    pass


class InactiveUserError(TeamError):
    pass


class InvalidLeadError(TeamError):
    pass


class AlreadyMemberError(TeamError):
    pass


class NotMemberError(TeamError):
    pass


# ---- Permission checks ----
def is_member(db: Session, team_id: int, user_id: int) -> bool:
    return db.get(TeamMember, (team_id, user_id)) is not None


def can_view_team(db: Session, team: Team, user: User) -> bool:
    if user.role.role_name == "admin" or team.lead_user_id == user.id:
        return True
    return is_member(db, team.id, user.id)


def can_manage_team(team: Team, user: User) -> bool:
    role = user.role.role_name
    # a lead must still HAVE the team_lead role, so demoting them removes their rights
    return role == "admin" or (role == "team_lead" and team.lead_user_id == user.id)


# ---- Queries ----
def get_team(db: Session, team_id: int) -> Team | None:
    return db.get(Team, team_id)


def list_teams(db: Session, user: User, skip: int = 0, limit: int = 50) -> list[Team]:
    stmt = select(Team).order_by(Team.id)
    if user.role.role_name != "admin":
        # everyone else sees only teams they lead or belong to
        member_of = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
        stmt = stmt.where(or_(Team.lead_user_id == user.id, Team.id.in_(member_of)))
    return list(db.scalars(stmt.offset(skip).limit(limit)))


# ---- Helpers ----
def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(Team.id).where(func.lower(Team.team_name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Team.id != exclude_id)
    return db.scalar(stmt) is not None


def _check_lead(db: Session, lead_user_id: int) -> None:
    user = db.get(User, lead_user_id)
    if user is None:
        raise UserNotFoundError()
    if user.status != "active" or user.role.role_name != "team_lead":
        raise InvalidLeadError()


# ---- Commands ----
def create_team(db: Session, data: TeamCreate) -> Team:
    if _name_taken(db, data.team_name):
        raise DuplicateTeamNameError()
    if data.lead_user_id is not None:
        _check_lead(db, data.lead_user_id)

    team = Team(
        team_name=data.team_name,
        description=data.description,
        lead_user_id=data.lead_user_id,
    )
    db.add(team)
    try:
        db.commit()
    except IntegrityError:  # two requests with the same name at the same moment
        db.rollback()
        raise DuplicateTeamNameError()
    db.refresh(team)
    return team


def update_team(db: Session, team: Team, data: TeamUpdate) -> list[str]:
    """Returns a list describing what changed, for the audit log."""
    changes: list[str] = []

    if data.team_name is not None and data.team_name != team.team_name:
        if _name_taken(db, data.team_name, exclude_id=team.id):
            raise DuplicateTeamNameError()  # raised before anything is modified
        changes.append(f"team_name: {team.team_name} -> {data.team_name}")
        team.team_name = data.team_name

    if data.description is not None and data.description != team.description:
        changes.append("description changed")  # not storing the text, it can be long
        team.description = data.description

    if changes:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise DuplicateTeamNameError()
        db.refresh(team)
    return changes


def set_lead(db: Session, team: Team, lead_user_id: int | None) -> int | None:
    """Returns the previous lead's id."""
    if lead_user_id is not None:
        _check_lead(db, lead_user_id)
    old_lead_id = team.lead_user_id
    team.lead_user_id = lead_user_id
    db.commit()
    db.refresh(team)
    return old_lead_id


def delete_team(db: Session, team: Team) -> None:
    db.delete(team)  # membership rows go with it (cascade)
    db.commit()


def add_member(db: Session, team: Team, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise UserNotFoundError()
    if user.status != "active":
        raise InactiveUserError()
    if is_member(db, team.id, user.id):
        raise AlreadyMemberError()

    db.add(TeamMember(team_id=team.id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:  # the composite primary key caught a race
        db.rollback()
        raise AlreadyMemberError()


def remove_member(db: Session, team: Team, user_id: int) -> None:
    membership = db.get(TeamMember, (team.id, user_id))
    if membership is None:
        raise NotMemberError()
    db.delete(membership)
    db.commit()