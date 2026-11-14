from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to NetShield AI"


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_login_endpoint_exists():
    response = client.post("/auth/login", json={})

    assert response.status_code == 422