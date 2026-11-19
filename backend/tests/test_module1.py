from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import AuditLog, RevokedToken, Role, Team, TeamMember, User
from app.security import hash_password


engine = create_engine("sqlite:///./test_module1.db", connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db


def seed():
    db = TestingSession()
    db.query(TeamMember).delete()
    db.query(Team).delete()
    db.query(AuditLog).delete()
    db.query(RevokedToken).delete()
    db.query(User).delete()
    db.query(Role).delete()
    db.commit()
    roles = {
        "Administrator": Role(role_name="Administrator", description="Administrators"),
        "Security Analyst": Role(role_name="Security Analyst", description="Analysts"),
        "Team Lead / Supervisor": Role(role_name="Team Lead / Supervisor", description="Team Leads"),
    }
    db.add_all(roles.values())
    db.flush()
    db.add_all([
        User(name="Admin", username="admin", email="admin@example.com",
             password_hash=hash_password("Admin123!"), is_active=True, role=roles["Administrator"]),
        User(name="Analyst", username="analyst", email="analyst@example.com",
             password_hash=hash_password("Analyst123!"), is_active=True, role=roles["Security Analyst"]),
        User(name="Lead", username="lead", email="lead@example.com",
             password_hash=hash_password("TeamLead123!"), is_active=True, role=roles["Team Lead / Supervisor"]),
    ])
    db.commit()
    db.close()


seed()
client = TestClient(app)


def login(identifier="admin", password="Admin123!"):
    response = client.post("/api/auth/login", json={"identifier": identifier, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_and_login():
    assert client.get("/api/health").json() == {"status": "ok"}
    token = login()
    assert client.get("/api/auth/me", headers=auth(token)).status_code == 200


def test_rbac_and_user_crud():
    admin_token = login()
    headers = auth(admin_token)
    created = client.post("/api/users/", headers=headers, json={
        "name": "New User", "username": "newuser", "email": "new@example.com",
        "password": "NewUser123!", "role": "Security Analyst", "is_active": True,
    })
    assert created.status_code == 201
    duplicate = client.post("/api/users/", headers=headers, json={
        "name": "Duplicate", "username": "newuser", "email": "other@example.com",
        "password": "NewUser123!", "role": "Security Analyst",
    })
    assert duplicate.status_code == 409

    analyst_token = login("analyst", "Analyst123!")
    assert client.get("/api/users/", headers=auth(analyst_token)).status_code == 403


def test_team_membership_and_audit():
    token = login()
    headers = auth(token)
    team = client.post("/api/teams/", headers=headers, json={
        "team_name": "Validation Team", "description": "Test team",
    })
    assert team.status_code == 201
    team_id = team.json()["id"]
    member = client.post(f"/api/teams/{team_id}/members", headers=headers,
                         json={"user_id": 2})
    assert member.status_code == 201
    detail = client.get(f"/api/teams/{team_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["member_count"] == 1
    audit = client.get("/api/audit-logs/", headers=headers)
    assert audit.status_code == 200
    assert audit.json()["total"] >= 1


def test_logout_revokes_token():
    token = login()
    headers = auth(token)
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401
