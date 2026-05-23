import os

import pytest
from fastapi.testclient import TestClient

from app.main import app, ROOM_STORE


@pytest.fixture(autouse=True)
def _no_search(monkeypatch):
    monkeypatch.setenv("BOT_NO_SEARCH", "1")


def _reset():
    for r in list(ROOM_STORE.iter_rooms()):
        ROOM_STORE.delete(r.id)


def test_post_room_returns_host_token_and_seat():
    _reset()
    client = TestClient(app)
    r = client.post("/api/rooms", json={"host_name": "Alice"})
    assert r.status_code == 200
    body = r.json()
    assert "room_id" in body
    assert "player_token" in body
    assert body["seat"] == 0
    assert body["ws_url"].startswith("/ws/rooms/")


def test_get_room_omits_tokens():
    _reset()
    client = TestClient(app)
    created = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    r = client.get(f"/api/rooms/{created['room_id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "lobby"
    assert all("token" not in p for p in body["players"])


def test_join_then_ready_then_start():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "Bob"}
    ).json()
    assert bob["seat"] == 1

    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": bob["player_token"]},
    )
    assert r.status_code == 403

    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": host["player_token"], "ready": True},
    )
    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": host["player_token"]},
    )
    assert r.status_code == 400

    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": bob["player_token"], "ready": True},
    )
    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": host["player_token"]},
    )
    assert r.status_code == 200
    assert "game_id" in r.json()


def test_join_returns_409_when_full():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    for name in ("B", "C", "D"):
        client.post(f"/api/rooms/{host['room_id']}/join", json={"name": name})
    r = client.post(f"/api/rooms/{host['room_id']}/join", json={"name": "E"})
    assert r.status_code == 409
