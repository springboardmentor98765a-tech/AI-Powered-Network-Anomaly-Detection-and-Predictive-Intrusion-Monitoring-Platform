
from app.models.audit_log import AuditLog
from app.models.team import TeamMember
from tests.conftest import auth_header, make_user


def create_team(client, headers, name="Network Team", lead=None):
    body = {"team_name": name}
    if lead is not None:
        body["lead_user_id"] = lead.id
    return client.post("/teams", json=body, headers=headers)


def add_member(client, headers, team_id, user):
    return client.post(f"/teams/{team_id}/members", json={"user_id": user.id}, headers=headers)


def test_only_admin_can_create_team(client, db_session):
    make_user(db_session, "boss", "admin")
    make_user(db_session, "asha", "security_analyst")
    make_user(db_session, "lena", "team_lead")
    assert create_team(client, auth_header(client, "asha")).status_code == 403
    assert create_team(client, auth_header(client, "lena")).status_code == 403
    assert create_team(client, auth_header(client, "boss")).status_code == 201


def test_duplicate_team_name_is_rejected_case_insensitively(client, db_session):
    make_user(db_session, "boss", "admin")
    admin_h = auth_header(client, "boss")
    assert create_team(client, admin_h, "Network Team").status_code == 201
    assert create_team(client, admin_h, "network team").status_code == 409


def test_lead_must_have_team_lead_role(client, db_session):
    make_user(db_session, "boss", "admin")
    analyst = make_user(db_session, "asha", "security_analyst")
    r = create_team(client, auth_header(client, "boss"), lead=analyst)
    assert r.status_code == 400


def test_lead_manages_only_own_team(client, db_session):
    make_user(db_session, "boss", "admin")
    lena = make_user(db_session, "lena", "team_lead")
    ravi = make_user(db_session, "ravi", "team_lead")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team_a = create_team(client, admin_h, "Team A", lead=lena).json()["id"]
    team_b = create_team(client, admin_h, "Team B", lead=ravi).json()["id"]

    lena_h = auth_header(client, "lena")
    assert add_member(client, lena_h, team_a, asha).status_code == 201
    assert add_member(client, lena_h, team_b, asha).status_code == 403
    # a lead cannot delete a team, even their own
    assert client.delete(f"/teams/{team_a}", headers=lena_h).status_code == 403


def test_analyst_member_cannot_manage_team(client, db_session):
    make_user(db_session, "boss", "admin")
    asha = make_user(db_session, "asha", "security_analyst")
    ravi = make_user(db_session, "ravi", "security_analyst")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h).json()["id"]
    add_member(client, admin_h, team, asha)

    asha_h = auth_header(client, "asha")
    assert add_member(client, asha_h, team, ravi).status_code == 403
    assert client.patch(f"/teams/{team}", json={"description": "x"}, headers=asha_h).status_code == 403


def test_member_sees_only_own_teams(client, db_session):
    make_user(db_session, "boss", "admin")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team_a = create_team(client, admin_h, "Team A").json()["id"]
    team_b = create_team(client, admin_h, "Team B").json()["id"]
    add_member(client, admin_h, team_a, asha)

    asha_h = auth_header(client, "asha")
    names = [t["team_name"] for t in client.get("/teams", headers=asha_h).json()]
    assert names == ["Team A"]
    assert client.get(f"/teams/{team_a}", headers=asha_h).status_code == 200
    assert client.get(f"/teams/{team_b}", headers=asha_h).status_code == 403
    # admin sees everything
    assert len(client.get("/teams", headers=admin_h).json()) == 2


def test_cannot_add_inactive_user(client, db_session):
    make_user(db_session, "boss", "admin")
    ghost = make_user(db_session, "ghost", "security_analyst", status="inactive")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h).json()["id"]
    assert add_member(client, admin_h, team, ghost).status_code == 400


def test_cannot_add_same_member_twice(client, db_session):
    make_user(db_session, "boss", "admin")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h).json()["id"]
    assert add_member(client, admin_h, team, asha).status_code == 201
    assert add_member(client, admin_h, team, asha).status_code == 409


def test_remove_member(client, db_session):
    make_user(db_session, "boss", "admin")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h).json()["id"]
    add_member(client, admin_h, team, asha)

    url = f"/teams/{team}/members/{asha.id}"
    assert client.delete(url, headers=admin_h).status_code == 204
    assert client.delete(url, headers=admin_h).status_code == 404  # no longer a member


def test_delete_team_is_admin_only_and_removes_memberships(client, db_session):
    make_user(db_session, "boss", "admin")
    lena = make_user(db_session, "lena", "team_lead")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h, lead=lena).json()["id"]
    add_member(client, admin_h, team, asha)

    assert client.delete(f"/teams/{team}", headers=auth_header(client, "lena")).status_code == 403
    assert client.delete(f"/teams/{team}", headers=admin_h).status_code == 204
    assert db_session.query(TeamMember).count() == 0
    assert client.get(f"/teams/{team}", headers=admin_h).status_code == 404


def test_team_changes_are_audited(client, db_session):
    make_user(db_session, "boss", "admin")
    asha = make_user(db_session, "asha", "security_analyst")
    admin_h = auth_header(client, "boss")
    team = create_team(client, admin_h).json()["id"]
    add_member(client, admin_h, team, asha)

    actions = {log.action for log in db_session.query(AuditLog).all()}
    assert {"team_create", "team_member_add"} <= actions