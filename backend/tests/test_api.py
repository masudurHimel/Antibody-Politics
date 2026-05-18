from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_create_game_returns_snapshot_and_ws_url():
    client = TestClient(app)
    r = client.post("/api/games", json={"seed": 7})
    assert r.status_code == 200
    body = r.json()
    assert "game_id" in body
    assert body["ws_url"].endswith(f"/ws/games/{body['game_id']}")
    assert body["snapshot"]["viewer_idx"] == 0
    assert len(body["snapshot"]["players"][0]["hand"]) == 3


def test_get_snapshot_for_existing_game():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    r = client.get(f"/api/games/{created['game_id']}/snapshot")
    assert r.status_code == 200
    assert r.json()["game_id"] == created["game_id"]


def test_get_snapshot_for_missing_game_404():
    client = TestClient(app)
    r = client.get("/api/games/nope/snapshot")
    assert r.status_code == 404
