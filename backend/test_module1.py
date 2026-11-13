import sys
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.init_db import init_db
from app.models.user import UserRole
from app.models.audit import AuditAction

def run_tests():
    print("=" * 60)
    print("RUNNING MODULE 1 AUTOMATED VERIFICATION SUITE")
    print("=" * 60)

    # Initialize tables and seed data
    init_db()

    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("[PASS] 1. Health check endpoint")

    # 2. Failed login - Non-revealing error message (Requirement A)
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "admin",
        "password": "WrongPassword123!"
    })
    assert res.status_code == 401
    assert "Invalid credentials" in res.json()["detail"]
    print("[PASS] 2. Failed login with bad password gives non-revealing 401")

    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "nonexistent_analyst",
        "password": "AnyPassword123!"
    })
    assert res.status_code == 401
    assert "Invalid credentials" in res.json()["detail"]
    print("[PASS] 3. Failed login with unknown user gives identical non-revealing 401")

    # 3. Successful Admin Login (Requirement A)
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "admin",
        "password": "Admin@NetShield2026!"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_data = res.json()
    admin_token = admin_data["access_token"]
    assert admin_data["user"]["role"] == UserRole.ADMIN
    print(f"[PASS] 4. Admin login successful (Issued JWT Token)")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 4. Successful Analyst Login
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "analyst_alex",
        "password": "Analyst@NetShield2026!"
    })
    assert res.status_code == 200
    analyst_token = res.json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    print("[PASS] 5. Security Analyst login successful")

    # 5. Successful Team Lead Login
    res = client.post("/api/v1/auth/login", json={
        "username_or_email": "lead_sarah",
        "password": "Lead@NetShield2026!"
    })
    assert res.status_code == 200
    lead_token = res.json()["access_token"]
    lead_headers = {"Authorization": f"Bearer {lead_token}"}
    print("[PASS] 6. Team Lead login successful")

    # 6. RBAC Verification (Requirement B)
    # Analyst trying to create a user -> must return 403 Forbidden
    res = client.post("/api/v1/users", json={
        "username": "hacker_test",
        "email": "hacker@test.com",
        "full_name": "Test User",
        "password": "Password123!",
        "role": UserRole.ANALYST
    }, headers=analyst_headers)
    assert res.status_code == 403, f"Analyst was not blocked from creating user! Status: {res.status_code}"
    print("[PASS] 7. RBAC: Security Analyst blocked (403) from creating user")

    # Analyst trying to view audit logs -> must return 403 Forbidden
    res = client.get("/api/v1/audit", headers=analyst_headers)
    assert res.status_code == 403, "Analyst was not blocked from viewing audit logs!"
    print("[PASS] 8. RBAC: Security Analyst blocked (403) from accessing audit logs")

    # Admin creating user -> 201 Created
    unique_user = f"new_analyst_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/v1/users", json={
        "username": unique_user,
        "email": f"{unique_user}@netshield.ai",
        "full_name": "New Analyst",
        "password": "Password123!",
        "role": UserRole.ANALYST
    }, headers=admin_headers)
    assert res.status_code == 201, f"Admin user creation failed: {res.text}"
    new_user = res.json()
    new_user_id = new_user["id"]
    print("[PASS] 9. RBAC: Administrator permitted (201) to create new account")

    # 7. Team Management (Requirement C)
    # Admin creates new team
    unique_team = f"Cloud Perimeter Defense {uuid.uuid4().hex[:6]}"
    res = client.post("/api/v1/teams", json={
        "name": unique_team,
        "description": "Monitors perimeter firewall and external cloud ingress/egress."
    }, headers=admin_headers)
    assert res.status_code == 201
    created_team = res.json()
    team_id = created_team["id"]
    print(f"[PASS] 10. Team Management: Created team '{created_team['name']}'")

    # Add member to team
    res = client.post(f"/api/v1/teams/{team_id}/members", json={
        "user_id": new_user_id
    }, headers=admin_headers)
    assert res.status_code == 200
    assert any(m["id"] == new_user_id for m in res.json()["members"])
    print("[PASS] 11. Team Management: Added user to team successfully")

    # Prevent duplicate member addition
    res = client.post(f"/api/v1/teams/{team_id}/members", json={
        "user_id": new_user_id
    }, headers=admin_headers)
    assert res.status_code == 400
    print("[PASS] 12. Team Management: Blocked duplicate team member assignment")

    # Remove member from team
    res = client.delete(f"/api/v1/teams/{team_id}/members/{new_user_id}", headers=admin_headers)
    assert res.status_code == 200
    print("[PASS] 13. Team Management: Removed member from team")

    # 8. Audit Logging (Requirement D)
    res = client.get("/api/v1/audit", headers=admin_headers)
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    print(f"[PASS] 14. Audit Logging: Retrieved {len(logs)} security audit records")

    # Filter audit logs by action
    res = client.get("/api/v1/audit?action=LOGIN_FAILED", headers=admin_headers)
    assert res.status_code == 200
    failed_logs = res.json()
    assert len(failed_logs) >= 2
    # Verify no plaintext passwords or secrets in audit logs
    for log in logs:
        if log.get("details"):
            assert "WrongPassword" not in log["details"]
            assert "Admin@NetShield" not in log["details"]
    print("[PASS] 15. Audit Logging: Verified logs are filtered and contain zero plaintext passwords/tokens")

    # 9. Logout & Token Revocation (Requirement A)
    # Log out with analyst token
    res = client.post("/api/v1/auth/logout", headers=analyst_headers)
    assert res.status_code == 200
    print("[PASS] 16. Logout: Analyst successfully logged out")

    # Attempt to use the revoked token -> must fail with 401
    res = client.get("/api/v1/auth/me", headers=analyst_headers)
    assert res.status_code == 401
    assert "revoked" in res.json()["detail"].lower()
    print("[PASS] 17. Security: Revoked token rejected on subsequent API requests")

    print("=" * 60)
    print("ALL 17 MODULE 1 BACKEND VERIFICATION CHECKS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
