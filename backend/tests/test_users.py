
from tests.conftest import PASSWORD, auth_header, make_user


def test_no_token_returns_401(client):
    assert client.get("/users").status_code == 401


def test_analyst_on_admin_route_returns_403(client, db_session):
    make_user(db_session, "asha", "security_analyst")
    headers = auth_header(client, "asha")
    assert client.get("/users", headers=headers).status_code == 403


def test_admin_can_list_users(client, db_session):
    make_user(db_session, "boss", "admin")
    headers = auth_header(client, "boss")
    assert client.get("/users", headers=headers).status_code == 200


def test_inactive_user_token_stops_working(client, db_session):
    user = make_user(db_session, "asha", "security_analyst")
    headers = auth_header(client, "asha")
    assert client.get("/users/me", headers=headers).status_code == 200

    user.status = "inactive"
    db_session.commit()
    assert client.get("/users/me", headers=headers).status_code == 401


def test_inactive_user_cannot_login(client, db_session):
    make_user(db_session, "ghost", "security_analyst", status="inactive")
    r = client.post("/auth/login", data={"username": "ghost", "password": PASSWORD})
    assert r.status_code == 401


def test_admin_cannot_deactivate_self(client, db_session):
    admin = make_user(db_session, "boss", "admin")
    headers = auth_header(client, "boss")
    r = client.patch(f"/users/{admin.id}/status", json={"status": "inactive"}, headers=headers)
    assert r.status_code == 400


def test_change_password_wrong_old_password(client, db_session):
    make_user(db_session, "asha", "security_analyst")
    headers = auth_header(client, "asha")
    r = client.post(
        "/auth/change-password",
        json={"old_password": "wrong-password", "new_password": "NewPass@12345"},
        headers=headers,
    )
    assert r.status_code == 400


def test_username_cannot_be_changed(client, db_session):
    make_user(db_session, "asha", "security_analyst")
    headers = auth_header(client, "asha")
    # No PATCH route exists for /users/me, so the method is not allowed
    r = client.patch("/users/me", json={"username": "newname"}, headers=headers)
    assert r.status_code == 405

def test_user_directory_access(client, db_session):
    make_user(db_session, "lena", "team_lead")
    make_user(db_session, "asha", "security_analyst")
    assert client.get("/users/directory", headers=auth_header(client, "asha")).status_code == 403
    r = client.get("/users/directory?q=as", headers=auth_header(client, "lena"))
    assert r.status_code == 200
    assert [u["username"] for u in r.json()] == ["asha"]