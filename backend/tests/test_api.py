# NetShield AI — Automated API tests (run with: pytest -q)
# Developed by Krish | SKK Projects
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_netshield.db"
os.environ["SIMULATOR_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
    if os.path.exists("test_netshield.db"):
        os.remove("test_netshield.db")


def token(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert r.status_code == 401


def test_requires_login(client):
    assert client.get("/api/alerts").status_code == 401


def test_viewer_cannot_create_users(client):
    h = token(client, "viewer", "viewer123")
    r = client.post("/api/users", headers=h, json={
        "username": "x1", "email": "x1@a.com", "password": "secret1", "role": "viewer"})
    assert r.status_code == 403


def test_admin_creates_user(client):
    h = token(client, "admin", "admin123")
    r = client.post("/api/users", headers=h, json={
        "username": "newanalyst", "email": "new@a.com", "password": "secret1", "role": "analyst"})
    assert r.status_code == 201


def test_detects_port_scan(client):
    h = token(client, "analyst", "analyst123")
    scan = {"src_ip": "45.155.205.233", "dst_ip": "10.0.1.10", "dst_port": 8443, "protocol": "TCP",
            "duration": 0.002, "fwd_packets": 1, "bwd_packets": 1, "fwd_bytes": 40, "bwd_bytes": 40,
            "syn_count": 1, "rst_count": 1}
    r = client.post("/api/traffic/analyze", headers=h, json=scan).json()
    assert r["predicted_attack"] == "PortScan"
    assert r["threat_intel"] is not None
    assert r["risk_score"] >= 25


def test_normal_web_traffic_is_benign(client):
    h = token(client, "analyst", "analyst123")
    web = {"src_ip": "192.168.1.20", "dst_ip": "10.0.1.11", "dst_port": 443, "protocol": "TCP",
           "duration": 1.8, "fwd_packets": 9, "bwd_packets": 8, "fwd_bytes": 3200, "bwd_bytes": 5400,
           "syn_count": 1, "ack_count": 16, "fin_count": 1}
    r = client.post("/api/traffic/analyze", headers=h, json=web).json()
    assert r["predicted_attack"] == "BENIGN"


def test_dashboard_endpoints(client):
    h = token(client, "viewer", "viewer123")
    for url in ["/api/analytics/overview", "/api/analytics/timeline", "/api/analytics/threat-intel",
                "/api/detection/metrics", "/api/detection/forecast", "/api/alerts", "/api/incidents"]:
        assert client.get(url, headers=h).status_code == 200, url


def test_incident_from_alerts(client):
    h = token(client, "analyst", "analyst123")
    alerts = client.get("/api/alerts", headers=h).json()
    ids = [a["id"] for a in alerts[:2]]
    r = client.post("/api/incidents", headers=h, json={"title": "Test incident", "alert_ids": ids})
    assert r.status_code == 201
    assert r.json()["alert_count"] == len(ids)
