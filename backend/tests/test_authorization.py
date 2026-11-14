
# Existing user authorization tests.

def test_admin_can_view_users(client, admin_headers):
    response = client.get("/users/", headers=admin_headers)
    assert response.status_code == 200

def test_analyst_cannot_view_users(client, analyst_headers):
    response = client.get("/users/", headers=analyst_headers)
    assert response.status_code == 403

def test_unauthenticated_user_cannot_view_users(client):
    response = client.get("/users/")
    assert response.status_code == 401

# Helper to create a team using the Admin API.

def create_test_team(client, admin_headers, name):
    response = client.post(
        "/teams/",
        headers=admin_headers,
        json={
            "name": name,
            "description": f"{name} description"
        }
    )

    assert response.status_code == 201
    return response.json()

# Helper to add a user to a team using the Admin API.

def add_test_member(client, admin_headers, team_id, user_id):
    response = client.post(
        "/team-members/",
        headers=admin_headers,
        json={
            "team_id": team_id,
            "user_id": user_id
        }
    )

    assert response.status_code == 201
    return response.json()

# Team authorization tests.

def test_admin_can_view_teams(client, admin_headers):
    response = client.get("/teams/", headers=admin_headers)
    assert response.status_code == 200

def test_analyst_can_view_assigned_teams(
    client,
    admin_headers,
    analyst_headers
):
    assigned_team = create_test_team(
        client, admin_headers, "Assigned Team"
    )

    create_test_team(
        client, admin_headers, "Unassigned Team"
    )

    add_test_member(
        client, admin_headers, assigned_team["id"], 2
    )

    response = client.get("/teams/", headers=analyst_headers)

    assert response.status_code == 200

    team_names = [team["name"] for team in response.json()]

    assert "Assigned Team" in team_names
    assert "Unassigned Team" not in team_names

def test_analyst_cannot_view_unassigned_team_members(
    client,
    admin_headers,
    analyst_headers
):
    team = create_test_team(
        client, admin_headers, "Other Analyst Team"
    )

    response = client.get(
        f"/team-members/{team['id']}",
        headers=analyst_headers
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "You are not assigned to this team"
    )

def test_unauthenticated_user_cannot_view_teams(client):
    response = client.get("/teams/")
    assert response.status_code == 401

# Viewer authorization tests.

def test_viewer_can_view_teams(
    client,
    admin_headers,
    viewer_headers
):
    create_test_team(client, admin_headers, "Viewer Team")

    response = client.get("/teams/", headers=viewer_headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_viewer_can_view_team_members(
    client,
    admin_headers,
    viewer_headers
):
    team = create_test_team(
        client, admin_headers, "Viewer Members Team"
    )

    add_test_member(
        client, admin_headers, team["id"], 2
    )

    response = client.get(
        f"/team-members/{team['id']}",
        headers=viewer_headers
    )

    assert response.status_code == 200

    members = response.json()

    assert len(members) == 1
    assert members[0]["user_id"] == 2
    assert members[0]["user_full_name"] == "Test Analyst"
    assert members[0]["user_email"] == "analyst@test.com"

def test_viewer_cannot_modify_teams_or_memberships(
    client,
    admin_headers,
    viewer_headers
):
    team = create_test_team(
        client, admin_headers, "Read Only Team"
    )

    add_test_member(
        client, admin_headers, team["id"], 2
    )

    # Viewer cannot create a team.
    create_response = client.post(
        "/teams/",
        headers=viewer_headers,
        json={
            "name": "Viewer Created Team",
            "description": "Should be rejected"
        }
    )

    assert create_response.status_code == 403

    # Viewer cannot update a team.
    update_response = client.put(
        f"/teams/{team['id']}",
        headers=viewer_headers,
        json={
            "name": "Changed Team",
            "description": "Should be rejected",
            "is_active": True
        }
    )

    assert update_response.status_code == 403

    # Viewer cannot delete a team.
    delete_response = client.delete(
        f"/teams/{team['id']}",
        headers=viewer_headers
    )

    assert delete_response.status_code == 403

    # Viewer cannot add a team member.
    add_response = client.post(
        "/team-members/",
        headers=viewer_headers,
        json={
            "team_id": team["id"],
            "user_id": 4
        }
    )

    assert add_response.status_code == 403

    # Viewer cannot remove a team member.
    remove_response = client.delete(
        f"/team-members/{team['id']}/2",
        headers=viewer_headers
    )

    assert remove_response.status_code == 403

# Audit log authorization tests.

def test_admin_can_view_audit_logs(client, admin_headers):
    response = client.get("/audit-logs/", headers=admin_headers)
    assert response.status_code == 200

def test_analyst_cannot_view_audit_logs(client, analyst_headers):
    response = client.get("/audit-logs/", headers=analyst_headers)
    assert response.status_code == 403

def test_unauthenticated_user_cannot_view_audit_logs(client):
    response = client.get("/audit-logs/")
    assert response.status_code == 401

# Last active Admin protection tests.

def test_admin_cannot_delete_own_account(client, admin_headers):
    response = client.delete(
        "/users/1",
        headers=admin_headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot delete your own account"

def test_admin_cannot_deactivate_own_account(client, admin_headers):
    response = client.put(
        "/users/1",
        headers=admin_headers,
        json={
            "full_name": "Test Admin",
            "role_id": 1,
            "is_active": False
        }
    )

    assert response.status_code == 400

def test_admin_cannot_demote_own_account(client, admin_headers):
    response = client.put(
        "/users/1",
        headers=admin_headers,
        json={
            "full_name": "Test Admin",
            "role_id": 2,
            "is_active": True
        }
    )

    assert response.status_code == 400

def test_admin_can_demote_second_admin_while_one_remains(
    client,
    admin_headers,
    second_admin_headers
):
    response = client.put(
        "/users/3",
        headers=admin_headers,
        json={
            "full_name": "Second Test Admin",
            "role_id": 2,
            "is_active": True
        }
    )

    assert response.status_code == 200
    assert response.json()["role_id"] == 2
    assert response.json()["is_active"] is True

    users_response = client.get(
        "/users/",
        headers=admin_headers
    )

    users = users_response.json()
    original_admin = next(user for user in users if user["id"] == 1)

    assert original_admin["role_id"] == 1
    assert original_admin["is_active"] is True

def test_admin_can_delete_second_admin_while_one_remains(
    client,
    admin_headers,
    second_admin_headers
):
    response = client.delete(
        "/users/3",
        headers=admin_headers
    )

    assert response.status_code == 200

    users_response = client.get(
        "/users/",
        headers=admin_headers
    )

    users = users_response.json()
    original_admin = next(user for user in users if user["id"] == 1)

    assert original_admin["role_id"] == 1
    assert original_admin["is_active"] is True