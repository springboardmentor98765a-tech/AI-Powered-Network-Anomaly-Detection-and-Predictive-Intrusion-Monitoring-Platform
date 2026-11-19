from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Team, TeamMember, User
from ..schemas import TeamCreate, TeamUpdate, MemberAdd
from ..dependencies import get_current_user, require_permission
from ..audit import audit

router = APIRouter(prefix="/api/teams", tags=["teams"])


def scoped_team_query(db: Session, user: User):
    query = db.query(Team)
    if user.role.role_name != "Administrator":
        query = query.join(TeamMember, TeamMember.team_id == Team.id).filter(TeamMember.user_id == user.id)
    return query


@router.post("/", status_code=201)
def create_team(payload: TeamCreate, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("teams.manage"))):
    if db.query(Team).filter(Team.team_name == payload.team_name).first():
        raise HTTPException(status_code=409, detail="Team name already exists")
    team = Team(team_name=payload.team_name.strip(), description=payload.description)
    db.add(team)
    db.flush()
    audit(db, actor.id, "team.create", "team", team.id, "success", {"team_name": team.team_name})
    db.commit()
    db.refresh(team)
    return {**{c.name: getattr(team, c.name) for c in team.__table__.columns}, "member_count": 0}


@router.get("/")
def list_teams(search: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not (user.role.role_name == "Administrator" or user.role.role_name in ("Team Lead / Supervisor", "Security Analyst")):
        raise HTTPException(status_code=403, detail="Permission denied")
    query = scoped_team_query(db, user)
    if search:
        query = query.filter(or_(Team.team_name.ilike(f"%{search}%"), Team.description.ilike(f"%{search}%")))
    total = query.count()
    teams = query.order_by(Team.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [{"id": t.id, "team_name": t.team_name, "description": t.description,
              "created_at": t.created_at, "member_count": len(t.members)} for t in teams]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{team_id}")
def team_detail(team_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    team = scoped_team_query(db, user).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found or not in scope")
    members = []
    for membership in team.members:
        members.append({"id": membership.user.id, "name": membership.user.name, "username": membership.user.username,
                        "email": membership.user.email, "role": membership.user.role.role_name,
                        "is_active": membership.user.is_active, "assigned_at": membership.assigned_at})
    return {"id": team.id, "team_name": team.team_name, "description": team.description,
            "created_at": team.created_at, "member_count": len(members), "members": members}


@router.put("/{team_id}")
def update_team(team_id: int, payload: TeamUpdate, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("teams.manage"))):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("team_name") and db.query(Team).filter(Team.id != team_id, Team.team_name == data["team_name"]).first():
        raise HTTPException(status_code=409, detail="Team name already exists")
    for key, value in data.items():
        setattr(team, key, value)
    audit(db, actor.id, "team.update", "team", team.id, "success", data)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("teams.manage"))):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    audit(db, actor.id, "team.delete", "team", team_id, "success", {"team_name": team.team_name})
    db.commit()
    return {"message": "Team deleted"}


@router.post("/{team_id}/members", status_code=201)
def add_member(team_id: int, payload: MemberAdd, db: Session = Depends(get_db),
               actor: User = Depends(require_permission("teams.manage"))):
    team = db.query(Team).filter(Team.id == team_id).first()
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=409, detail="Cannot add inactive user")
    if db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user.id).first():
        raise HTTPException(status_code=409, detail="User is already a team member")
    membership = TeamMember(team_id=team_id, user_id=user.id)
    db.add(membership)
    db.flush()
    audit(db, actor.id, "team.member_add", "team", team_id, "success", {"user_id": user.id})
    db.commit()
    return {"message": "Member added"}


@router.delete("/{team_id}/members/{user_id}")
def remove_member(team_id: int, user_id: int, db: Session = Depends(get_db),
                  actor: User = Depends(require_permission("teams.manage"))):
    membership = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Team membership not found")
    db.delete(membership)
    audit(db, actor.id, "team.member_remove", "team", team_id, "success", {"user_id": user_id})
    db.commit()
    return {"message": "Member removed"}
