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


def test_cors_allows_local_frontend_origins(client):
    for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert r.status_code == 401


def test_requires_login(client):
    assert client.get("/api/alerts").status_code == 401


def test_live_sensor_status_is_available_to_signed_in_users(client):
    headers = token(client, "viewer", "viewer123")
    response = client.get("/api/traffic/sensor/status", headers=headers)
    assert response.status_code == 200
    assert response.json()["metadata_only"] is True

    denied = client.post("/api/traffic/sensor/start", headers=headers)
    assert denied.status_code == 403


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
                "/api/detection/metrics", "/api/detection/forecast", "/api/alerts", "/api/incidents", "/api/teams"]:
        assert client.get(url, headers=h).status_code == 200, url


def test_incident_from_alerts(client):
    h = token(client, "analyst", "analyst123")
    alerts = client.get("/api/alerts", headers=h).json()
    ids = [a["id"] for a in alerts[:2]]
    r = client.post("/api/incidents", headers=h, json={"title": "Test incident", "alert_ids": ids})
    assert r.status_code == 201
    assert r.json()["alert_count"] == len(ids)

def test_module2_traffic_stats(client):

    headers = token(client, "viewer", "viewer123")

    response = client.get(
        "/api/traffic/stats?minutes=60",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert "protocol_stats" in data
    assert "unknown_protocols" in data
    assert "unknown_protocol_types" in data
    assert "unknown_protocol_flows" in data

    assert "top_sources" in data
    assert "top_destinations" in data
    assert "top_ports" in data

    assert "direction" in data
    assert "timeline" in data

    assert sum(
        item["flows"] for item in data["protocol_stats"]
    ) == data["flows"]

    assert len(data["timeline"]) <= 2016

    assert "inbound" in data["direction"]
    assert "outbound" in data["direction"]


def test_module2_flow_filters(client):

    headers = token(client, "viewer", "viewer123")

    original = client.get(
        "/api/traffic/flows?limit=100",
        headers=headers
    )

    assert original.status_code == 200

    rows = original.json()

    if not rows:
        return

    sample = rows[0]

    response = client.get(
        "/api/traffic/flows",
        params={
            "limit": 100,
            "src_ip": sample["src_ip"],
            "dst_ip": sample["dst_ip"],
            "protocol": sample["protocol"],
        },
        headers=headers
    )

    assert response.status_code == 200

    filtered = response.json()

    assert len(filtered) > 0

    assert all(
        item["src_ip"] == sample["src_ip"]
        and item["dst_ip"] == sample["dst_ip"]
        and item["protocol"].upper() == sample["protocol"].upper()
        for item in filtered
    )


def test_module2_invalid_time_range(client):

    headers = token(client, "viewer", "viewer123")

    response = client.get(
        "/api/traffic/stats?minutes=0",
        headers=headers
    )

    assert response.status_code == 422


def test_csv_upload_reports_rejected_records(client):
    headers = token(client, "analyst", "analyst123")
    csv = "\n".join([
        "src_ip,dst_ip,src_port,dst_port,protocol_num,duration,fwd_packets,bwd_packets,fwd_bytes,bwd_bytes,flow_bytes_per_s,flow_packets_per_s,syn_count,ack_count,rst_count,fin_count,avg_packet_size",
        "192.168.1.20,10.0.1.11,51000,443,6,1.5,9,8,3200,5400,4777.7,11.3,1,16,0,1,505.8",
        "192.168.1.21,10.0.1.12,51001,443,6,not-a-number,9,8,3200,5400,4777.7,11.3,1,16,0,1,505.8",
    ])
    response = client.post(
        "/api/traffic/upload",
        headers=headers,
        files={"file": ("flows.csv", csv, "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["rows_processed"] == 1
    assert response.json()["rows_rejected"] == 1
    assert response.json()["failed_records"] == 0


def test_wireshark_packet_csv_is_aggregated(client):
    headers = token(client, "analyst", "analyst123")
    csv = "\n".join([
        "No.,Time,Source,Destination,Protocol,Length,Info",
        "1,0.000,192.168.1.20,10.0.1.11,TCP,60,51000 -> 443 [SYN]",
        "2,0.100,192.168.1.20,10.0.1.11,TCP,72,51000 -> 443 [ACK]",
        "3,0.150,192.168.1.20,10.0.1.11,TCP,72,51000 -> 443 [ACK]",
    ])
    response = client.post(
        "/api/traffic/upload",
        headers=headers,
        files={"file": ("wireshark-export.csv", csv, "text/csv")},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["ingestion_source"] == "wireshark_csv"
    assert data["capture_packets"] == 3
    assert data["rows_processed"] == 1


def test_wireshark_bom_quoted_info_and_reverse_packets_form_one_flow(client):
    headers = token(client, "analyst", "analyst123")
    csv = "\n".join([
        ' No , Time , Source Address , Destination Address , Protocol , Packet Length , Info ',
        '1,0.000,192.168.50.20,10.0.1.11,TCP,60,"51000 → 443 [SYN], Seq=0"',
        '2,0.100,10.0.1.11,192.168.50.20,TCP,72,"443 → 51000 [SYN, ACK], Ack=1"',
        '3,0.200,192.168.50.20,10.0.1.11,TCP,100,"51000 → 443 [ACK], Len=0"',
    ]).encode("utf-8-sig")
    response = client.post(
        "/api/traffic/upload",
        headers=headers,
        files={"file": ("wireshark-bom.csv", csv, "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["rows_processed"] == 1

    flows = client.get(
        "/api/traffic/flows?src_ip=192.168.50.20&dst_ip=10.0.1.11",
        headers=headers,
    ).json()
    flow = next(row for row in flows if row["source"] == "wireshark_csv")
    assert flow["fwd_packets"] == 2
    assert flow["bwd_packets"] == 1
    assert flow["fwd_bytes"] == 160
    assert flow["bwd_bytes"] == 72

    stats = client.get("/api/traffic/stats?minutes=60", headers=headers).json()
    assert any(item["protocol"] == "TCP" for item in stats["protocol_stats"])
    overview = client.get("/api/analytics/overview?minutes=60", headers=headers).json()
    assert overview["total_flows"] >= 1


def test_wireshark_windows_1252_csv_is_supported(client):
    headers = token(client, "analyst", "analyst123")
    csv = "\n".join([
        "No.;Time;Source;Destination;Protocol;Length;Info",
        '1;0.000;192.168.50.30;10.0.1.12;TCP;64;"53000 -> 443 [SYN], Len=0"',
    ]).encode("cp1252")
    response = client.post(
        "/api/traffic/upload",
        headers=headers,
        files={"file": ("wireshark-cp1252.csv", csv, "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["ingestion_source"] == "wireshark_csv"
    assert response.json()["rows_processed"] == 1


def test_public_registration_requires_admin_approval(client):
    response = client.post("/api/auth/register", json={
        "full_name": "Pending Analyst",
        "email": "pending@example.test",
        "password": "safe-password-123",
        "requested_role": "analyst",
    })
    assert response.status_code == 201, response.text

    denied = client.post("/api/auth/login", json={
        "username": "pending@example.test",
        "password": "safe-password-123",
    })
    assert denied.status_code == 403

    admin = token(client, "admin", "admin123")
    pending = client.get("/api/admin/registration-requests", headers=admin)
    assert pending.status_code == 200
    request = next(user for user in pending.json() if user["email"] == "pending@example.test")

    approved = client.post(
        f"/api/users/{request['id']}/approve",
        headers=admin,
        json={"role": "analyst"},
    )
    assert approved.status_code == 200
    assert token(client, "pending@example.test", "safe-password-123")
