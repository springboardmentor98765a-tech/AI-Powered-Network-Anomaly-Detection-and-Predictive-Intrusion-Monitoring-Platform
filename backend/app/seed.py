# NetShield AI — First-run setup: default team, demo users and sample traffic
# Developed by Krish | SKK Projects
from app import models
from app.auth import hash_password
from app.database import SessionLocal

DEMO_USERS = [
    ("admin", "admin@netshield.local", "System Administrator", "admin123", "admin"),
    ("analyst", "analyst@netshield.local", "SOC Analyst", "analyst123", "analyst"),
    ("viewer", "viewer@netshield.local", "Security Viewer", "viewer123", "viewer"),
]


def seed_users() -> None:
    db = SessionLocal()
    try:
        if db.query(models.User).count() > 0:
            return
        team = models.Team(name="SOC Team Alpha", description="Default security operations team")
        db.add(team)
        db.flush()
        for username, email, name, password, role in DEMO_USERS:
            db.add(models.User(username=username, email=email, full_name=name, role=role,
                               team_id=team.id, hashed_password=hash_password(password)))
        db.commit()
        print("[seed] created demo users: admin/admin123, analyst/analyst123, viewer/viewer123")
    finally:
        db.close()


def needs_history() -> bool:
    db = SessionLocal()
    try:
        return db.query(models.TrafficFlow).count() == 0
    finally:
        db.close()
