
from app.models.audit_log import AuditLog
from tests.conftest import auth_header, make_user


def test_failed_login_is_logged_without_password(client, db_session):
    make_user(db_session, "asha", "security_analyst")
    client.post("/auth/login", data={"username": "asha", "password": "WrongPass@1"})

    log = db_session.query(AuditLog).filter_by(action="login").one()
    assert log.status == "failure"
    assert log.actor_user_id is None
    assert "WrongPass@1" not in (log.details or "")  # the password must never be stored


def test_successful_login_is_logged(client, db_session):
    user = make_user(db_session, "asha", "security_analyst")
    auth_header(client, "asha")

    log = db_session.query(AuditLog).filter_by(action="login", status="success").one()
    assert log.actor_user_id == user.id


def test_non_admin_cannot_read_logs(client, db_session):
    make_user(db_session, "asha", "security_analyst")
    headers = auth_header(client, "asha")
    assert client.get("/audit-logs", headers=headers).status_code == 403


def test_admin_can_read_logs(client, db_session):
    make_user(db_session, "boss", "admin")
    headers = auth_header(client, "boss")
    r = client.get("/audit-logs", headers=headers)
    assert r.status_code == 200
    assert r.json()[0]["action"] == "login"


def test_audit_logs_cannot_be_deleted(client, db_session):
    make_user(db_session, "boss", "admin")
    headers = auth_header(client, "boss")
    assert client.delete("/audit-logs", headers=headers).status_code == 405