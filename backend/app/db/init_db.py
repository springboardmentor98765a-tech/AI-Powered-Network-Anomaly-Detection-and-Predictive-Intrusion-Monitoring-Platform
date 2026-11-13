from sqlalchemy.orm import Session
from app.db.session import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.team import Team
from app.models.token_blocklist import TokenBlocklist
from app.models.audit import AuditLog, AuditAction, AuditStatus

def init_db():
    # Create all database tables
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # Check if admin already exists
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("[INFO] Seeding initial Administrator, Team Lead, Analysts, and Teams...")

            # 1. Admin
            admin = User(
                username="admin",
                email="admin@netshield.ai",
                full_name="System Administrator",
                hashed_password=hash_password("Admin@NetShield2026!"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)

            # 2. Team Lead
            lead_sarah = User(
                username="lead_sarah",
                email="sarah.chen@netshield.ai",
                full_name="Sarah Chen",
                hashed_password=hash_password("Lead@NetShield2026!"),
                role=UserRole.TEAM_LEAD,
                is_active=True,
            )
            db.add(lead_sarah)

            # 3. Security Analysts
            analyst_alex = User(
                username="analyst_alex",
                email="alex.rivera@netshield.ai",
                full_name="Alex Rivera",
                hashed_password=hash_password("Analyst@NetShield2026!"),
                role=UserRole.ANALYST,
                is_active=True,
            )
            db.add(analyst_alex)

            analyst_priya = User(
                username="analyst_priya",
                email="priya.patel@netshield.ai",
                full_name="Priya Patel",
                hashed_password=hash_password("Analyst@NetShield2026!"),
                role=UserRole.ANALYST,
                is_active=True,
            )
            db.add(analyst_priya)

            db.commit()
            db.refresh(admin)
            db.refresh(lead_sarah)
            db.refresh(analyst_alex)
            db.refresh(analyst_priya)

            # 4. Teams
            hunting_team = Team(
                name="Network Threat Hunting Team",
                description="Specialized in proactive intrusion detection, behavioral packet anomaly inspection, and zero-day threat correlation.",
                lead_id=lead_sarah.id,
            )
            db.add(hunting_team)

            incident_team = Team(
                name="SOC Incident Response Team",
                description="Responsible for triage, containment, and eradication of critical network intrusion alerts.",
            )
            db.add(incident_team)

            db.commit()
            db.refresh(hunting_team)
            db.refresh(incident_team)

            # Assign users to teams
            lead_sarah.team_id = hunting_team.id
            analyst_alex.team_id = hunting_team.id
            analyst_priya.team_id = incident_team.id
            db.commit()

            # 5. Initial Audit Log
            init_audit = AuditLog(
                actor_id=admin.id,
                actor_username="admin",
                action=AuditAction.USER_CREATE,
                target_type="SYSTEM",
                status=AuditStatus.SUCCESS,
                details='{"event": "NetShield AI Platform Initialized", "seed_roles": ["Administrator", "Team Lead", "Security Analyst"]}',
                ip_address="127.0.0.1",
            )
            db.add(init_audit)
            db.commit()

            print("[SUCCESS] Initial seed data created successfully.")
        else:
            print("[INFO] Database already initialized.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
