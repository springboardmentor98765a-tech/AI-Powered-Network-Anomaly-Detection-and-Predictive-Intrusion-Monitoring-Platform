def test_network_monitoring_is_admin_only_for_analyst(client, analyst_headers):
    response = client.get("/network/status", headers=analyst_headers)
    assert response.status_code == 403


def test_network_monitoring_is_admin_only_for_viewer(client, viewer_headers):
    response = client.get("/network/status", headers=viewer_headers)
    assert response.status_code == 403


def test_network_monitoring_requires_authentication(client):
    response = client.get("/network/status")
    assert response.status_code in (401, 403)
