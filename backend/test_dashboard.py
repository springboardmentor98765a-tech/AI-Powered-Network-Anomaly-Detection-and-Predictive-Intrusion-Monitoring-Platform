import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Role
from sqlalchemy import select

def login(c, email, pw):
    return c.post("/login", data={"email": email, "password": pw}, follow_redirects=False)

def test_requires_login():
    with TestClient(app) as c:
        r = c.get("/dashboard", follow_redirects=False)
        assert r.status_code == 303 and r.headers["location"] == "/login"
        assert c.get("/api/dashboard").status_code == 401

def test_bad_login_is_generic():
    with TestClient(app) as c:
        a = login(c, "admin@demo.local", "wrong")
        b = login(c, "nobody@demo.local", "wrong")
        d = login(c, "old@demo.local", "Old@12345")  # inactive
        assert a.status_code == b.status_code == d.status_code == 401
        assert "Invalid credentials." in a.text and "Invalid credentials." in b.text and "Invalid credentials." in d.text

def test_admin_view():
    with TestClient(app) as c:
        assert login(c, "admin@demo.local", "Admin@123").status_code == 303
        j = c.get("/api/dashboard").json()
        assert [n["label"] for n in j["nav"]] == ["Dashboard","User Management","Roles & Permissions","Team Management","Audit Logs"]
        assert j["stats"]["total_users"] == 5 and j["stats"]["active_users"] == 4
        assert j["stats"]["failed_logins_24h"] >= 3
        assert "Recent activity" in c.get("/dashboard").text

def test_lead_view():
    with TestClient(app) as c:
        login(c, "lead@demo.local", "Lead@123")
        j = c.get("/api/dashboard").json()
        assert j["stats"] is None and j["events"] is None
        assert "Audit Logs" not in [n["label"] for n in j["nav"]]
        assert len(j["teams"][0]["members"]) == 3

def test_analyst_view():
    with TestClient(app) as c:
        login(c, "analyst@demo.local", "Analyst@123")
        j = c.get("/api/dashboard").json()
        assert [n["label"] for n in j["nav"]] == ["Dashboard","Network Activity","Alerts"]
        assert j["teams"][0]["member_count"] == 3 and j["teams"][0]["members"] == []
        html = c.get("/dashboard").text
        assert "Recent activity" not in html and "Roster" not in html

def test_logout():
    with TestClient(app) as c:
        login(c, "analyst@demo.local", "Analyst@123")
        c.post("/logout", follow_redirects=False)
        assert c.get("/api/dashboard").status_code == 401


def test_react_auth_api_sets_and_clears_session_cookie():
    with TestClient(app) as c:
        response = c.post("/api/auth/login", json={
            "identifier": "analyst@demo.local",
            "password": "Analyst@123",
        })
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "analyst@demo.local"
        assert "httponly" in response.headers["set-cookie"].lower()
        assert c.get("/api/auth/me").status_code == 200
        assert c.get("/api/dashboard").status_code == 200
        assert c.post("/api/auth/logout").json() == {"ok": True}
        assert c.get("/api/dashboard").status_code == 401


def test_login_accepts_username():
    with TestClient(app) as c:
        response = c.post("/login", data={"username": "Asha Admin", "password": "Admin@123"},
                           follow_redirects=False)
        assert response.status_code == 303

def test_admin_management_pages():
    with TestClient(app) as c:
        login(c, "admin@demo.local", "Admin@123")
        for path in ("/admin/users", "/admin/roles", "/teams", "/admin/audit-logs"):
            response = c.get(path)
            assert response.status_code == 200, (path, response.text)

def test_management_access_is_role_protected():
    with TestClient(app) as c:
        login(c, "analyst@demo.local", "Analyst@123")
        assert c.get("/admin/users").status_code == 403
        assert c.get("/admin/roles").status_code == 403
        assert c.get("/admin/audit-logs").status_code == 403
        assert c.get("/teams").status_code == 403

def test_team_lead_can_manage_team_page_only():
    with TestClient(app) as c:
        login(c, "lead@demo.local", "Lead@123")
        assert c.get("/teams").status_code == 200
        assert c.get("/admin/users").status_code == 403

def test_dataset_pages_show_bounded_csv_data():
    with TestClient(app) as c:
        login(c, "analyst@demo.local", "Analyst@123")
        activity = c.get("/monitoring/activity")
        alerts = c.get("/monitoring/alerts")
        assert activity.status_code == alerts.status_code == 200
        assert "Read-only CIC-IDS 2018 demonstration" in activity.text
        assert "FTP-BruteForce" in alerts.text
        assert "50,000" in activity.text

def test_admin_can_manage_users_roles_and_teams():
    with SessionLocal() as db:
        analyst_role = db.scalar(select(Role).where(Role.role_name == "security_analyst"))
        lead_role = db.scalar(select(Role).where(Role.role_name == "team_lead"))
        analyst_role_id, lead_role_id = analyst_role.id, lead_role.id
    with TestClient(app) as c:
        login(c, "admin@demo.local", "Admin@123")
        created = c.post("/admin/users", data={
            "name": "Workflow User", "email": "workflow@demo.local",
            "password": "Workflow@123", "role_id": analyst_role_id,
        }, follow_redirects=False)
        assert created.status_code == 303
        with SessionLocal() as db:
            from app.models import User
            member = db.scalar(select(User).where(User.email == "workflow@demo.local"))
            member_id = member.id
        assert c.post(f"/admin/users/{member_id}/update",
                      data={"name": "Updated Workflow User", "email": "updated@demo.local"},
                      follow_redirects=False).status_code == 303
        assert c.post("/admin/roles/assign", data={
            "user_id": member_id, "role_id": lead_role_id, "operation": "assign",
        }, follow_redirects=False).status_code == 303
        assert c.post("/admin/roles/assign", data={
            "user_id": member_id, "role_id": lead_role_id, "operation": "remove",
        }, follow_redirects=False).status_code == 303
        assert c.post("/teams", data={"name": "Workflow Team", "description": "Test"},
                      follow_redirects=False).status_code == 303
        with SessionLocal() as db:
            from app.models import Team
            team_id = db.scalar(select(Team).where(Team.team_name == "Workflow Team")).id
        assert c.post(f"/teams/{team_id}/members", data={"user_id": member_id},
                      follow_redirects=False).status_code == 303
        assert c.post(f"/teams/{team_id}/members/{member_id}/remove",
                      follow_redirects=False).status_code == 303
        assert c.post(f"/admin/users/{member_id}/status", data={"status": "inactive"},
                      follow_redirects=False).status_code == 303
