"""Demo data so the dashboard has something to show."""
from sqlalchemy.orm import Session

from .audit import log_event
from .models import Role, Team, User
from .permissions import ADMIN, ANALYST, LEAD
from .security import hash_password


def seed(db: Session) -> None:
    if db.query(Role).first():
        return
    roles = {
        ADMIN: Role(role_name=ADMIN, description="Manage users, roles, teams, settings; view audit logs"),
        LEAD: Role(role_name=LEAD, description="Oversee team activity and assigned analysts"),
        ANALYST: Role(role_name=ANALYST, description="Monitor, review alerts, investigate events"),
    }
    db.add_all(roles.values())

    def mk(name, email, pw, role, status="active"):
        u = User(name=name, email=email, password_hash=hash_password(pw), status=status)
        u.roles.append(roles[role])
        return u

    admin = mk("Asha Admin", "admin@demo.local", "Admin@123", ADMIN)
    lead = mk("Lena Lead", "lead@demo.local", "Lead@123", LEAD)
    a1 = mk("Arun Analyst", "analyst@demo.local", "Analyst@123", ANALYST)
    a2 = mk("Meera Analyst", "meera@demo.local", "Analyst@123", ANALYST)
    old = mk("Old Account", "old@demo.local", "Old@12345", ANALYST, status="inactive")

    team = Team(team_name="Network Monitoring Team",
                description="24x7 network traffic monitoring and triage")
    team.members.extend([lead, a1, a2])
    db.add_all([admin, lead, a1, a2, old, team])
    db.commit()
    log_event(db, admin.id, "team.create", "success", "team", team.id)
