"""Development seed: run python seed.py. Demo credentials are documented and not production defaults."""
from app.database import Base, engine, SessionLocal
from app.models import Role, User
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()
roles = [
    ("Administrator", "Create and manage users, teams, roles, and audit logs."),
    ("Security Analyst", "Investigate monitoring activity and manage only the analyst's own profile."),
    ("Team Lead / Supervisor", "View assigned teams and oversee assigned analysts."),
]
for name, description in roles:
    if not db.query(Role).filter(Role.role_name == name).first():
        db.add(Role(role_name=name, description=description))
db.commit()

demo_users = [
    ("Admin User", "admin", "admin@example.com", "Admin123", "Administrator"),
    ("Security Analyst", "analyst", "analyst@example.com", "Analyst123!", "Security Analyst"),
    ("Team Lead", "teamlead", "lead@example.com", "TeamLead123!", "Team Lead / Supervisor"),
]
for name, username, email, password, role_name in demo_users:
    if not db.query(User).filter(User.username == username).first():
        role = db.query(Role).filter(Role.role_name == role_name).first()
        db.add(User(name=name, username=username, email=email, password_hash=hash_password(password),
                    is_active=True, role=role))
db.commit()
print("Seed complete. Development demo users: admin / Admin123!, analyst / Analyst123!, teamlead / TeamLead123!")
