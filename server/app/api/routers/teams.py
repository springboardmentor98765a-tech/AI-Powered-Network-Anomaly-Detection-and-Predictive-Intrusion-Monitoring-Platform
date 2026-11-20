from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Team, User, team_members
from app.schemas import TeamCreate, TeamResponse, TeamMemberAdd
from app.api.dependencies import get_current_user, require_roles
from app.api.audit import log_audit_event

router = APIRouter(prefix="/api/teams", tags=["Team Management"])

@router.get("/", response_model=list[TeamResponse])
def get_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Administrators and Team Leads can view teams; analysts see teams they belong to
    user_roles = {r.role_name for r in current_user.roles}
    if "Administrator" in user_roles or "Team Lead" in user_roles:
        return db.query(Team).all()
    return current_user.teams

@router.post("/", response_model=TeamResponse)
def create_team(body: TeamCreate, current_user: User = Depends(require_roles(["Administrator", "Team Lead"])), db: Session = Depends(get_db)):
    existing = db.query(Team).filter(Team.team_name == body.team_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    
    team = Team(team_name=body.team_name, description=body.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    
    log_audit_event(db, actor_user_id=current_user.id, action="TEAM_CREATED", target_type="TEAM", target_id=team.id, status="SUCCESS", details={"team_name": team.team_name})
    return team

@router.post("/{team_id}/members")
def add_team_member(team_id: int, body: TeamMemberAdd, current_user: User = Depends(require_roles(["Administrator", "Team Lead"])), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    user = db.query(User).filter(User.id == body.user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=404, detail="Active user not found")
    
    if user in team.members:
        raise HTTPException(status_code=400, detail="User is already a member of this team")
    
    team.members.append(user)
    db.commit()
    
    log_audit_event(db, actor_user_id=current_user.id, action="TEAM_MEMBER_ADDED", target_type="TEAM", target_id=team.id, status="SUCCESS", details={"user_id": user.id})
    return {"message": "User added to team successfully"}

@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(team_id: int, user_id: int, current_user: User = Depends(require_roles(["Administrator", "Team Lead"])), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user not in team.members:
        raise HTTPException(status_code=404, detail="User not found in this team")
    
    team.members.remove(user)
    db.commit()
    
    log_audit_event(db, actor_user_id=current_user.id, action="TEAM_MEMBER_REMOVED", target_type="TEAM", target_id=team.id, status="SUCCESS", details={"user_id": user.id})
    return {"message": "User removed from team successfully"}

@router.delete("/{team_id}")
def delete_team(team_id: int, current_user: User = Depends(require_roles(["Administrator", "Team Lead"])), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    db.delete(team)
    db.commit()

    log_audit_event(db, actor_user_id=current_user.id, action="TEAM_DELETED", target_type="TEAM", target_id=team_id, status="SUCCESS", details={"team_name": team.team_name})
    return {"message": "Team deleted successfully"}