from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password

db = SessionLocal()

print("🌱 Starting database seeding...")

# 1. Ensure Roles Exist
roles_data = [
    ("Administrator", "Manage users, roles, teams, and platform settings; view audit logs."),
    ("Security Analyst", "Use security monitoring and investigation features assigned to them."),
    ("Team Lead", "View team activity and oversee assigned analysts.")  # Acts as Manager
]

for name, desc in roles_data:
    existing_role = db.query(Role).filter(Role.role_name == name).first()
    if not existing_role:
        db.add(Role(role_name=name, description=desc))
db.commit()

# Fetch role references
admin_role = db.query(Role).filter(Role.role_name == "Administrator").first()
lead_role = db.query(Role).filter(Role.role_name == "Team Lead").first()
analyst_role = db.query(Role).filter(Role.role_name == "Security Analyst").first()

# Define users to create
users_to_create = [
    # 1 Admin
    {"name": "System Administrator", "email": "admin@netshield.ai", "password": "AdminSecure123!", "role": admin_role},
    
    # 2 Managers (Team Leads)
    {"name": "Alice Manager", "email": "alice.lead@netshield.ai", "password": "LeadPassword123!", "role": lead_role},
    {"name": "Bob Manager", "email": "bob.lead@netshield.ai", "password": "LeadPassword123!", "role": lead_role},
    
    # 5 Analysts
    {"name": "Analyst Charlie", "email": "charlie@netshield.ai", "password": "AnalystPassword123!", "role": analyst_role},
    {"name": "Analyst Diana", "email": "diana@netshield.ai", "password": "AnalystPassword123!", "role": analyst_role},
    {"name": "Analyst Ethan", "email": "ethan@netshield.ai", "password": "AnalystPassword123!", "role": analyst_role},
    {"name": "Analyst Fiona", "email": "fiona@netshield.ai", "password": "AnalystPassword123!", "role": analyst_role},
    {"name": "Analyst George", "email": "george@netshield.ai", "password": "AnalystPassword123!", "role": analyst_role},
]

# 2. Seed Users
for u_data in users_to_create:
    existing_user = db.query(User).filter(User.email == u_data["email"]).first()
    if not existing_user:
        new_user = User(
            name=u_data["name"],
            email=u_data["email"],
            password_hash=hash_password(u_data["password"]),
            status="active"
        )
        new_user.roles.append(u_data["role"])
        db.add(new_user)
        print(f"Created user: {u_data['email']} ({u_data['role'].role_name})")
    else:
        print(f"User already exists: {u_data['email']}")

db.commit()
db.close()
print("✅ Seeding completed successfully!")