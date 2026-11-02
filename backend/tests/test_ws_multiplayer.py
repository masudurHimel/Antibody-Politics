import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _disable_bot_search():
    os.environ["BOT_NO_SEARCH"] = "1"
    yield
    os.environ.pop("BOT_NO_SEARCH", None)


from app.main import app, BROADCASTERS, DRIVERS, ROOM_STORE  # noqa: E402


def _reset():
    for r in list(ROOM_STORE.iter_rooms()):
        ROOM_STORE.delete(r.id)
    DRIVERS.clear()
    BROADCASTERS.clear()


def test_lobby_socket_receives_room_state():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws:
        msg = ws.receive_json()
        assert msg["type"] == "room_state"
        assert msg["my_seat"] == 0
        assert msg["room"]["status"] == "lobby"


def test_unknown_token_closes_with_error():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token=deadbeef"
    ) as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["code"] == "bad_token"


def test_two_humans_both_receive_action():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "B"}
    ).json()
    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": host["player_token"], "ready": True},
    )
    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": bob["player_token"], "ready": True},
    )

    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws_a, client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
    ) as ws_b:
        ws_a.receive_json()
        ws_b.receive_json()
        client.post(
            f"/api/rooms/{host['room_id']}/start",
            json={"player_token": host["player_token"]},
        )
        a = ws_a.receive_json()
        b = ws_b.receive_json()
        # start first broadcasts room_state (status=playing) so lobby clients switch screens
        game_msgs = ("room_state", "snapshot", "human_thinking", "bot_thinking", "action")
        assert a["type"] in game_msgs
        assert b["type"] in game_msgs


def test_set_pace_is_ignored_in_multiplayer_rooms(monkeypatch):
    from app.driver import GameDriver
    calls = []
    monkeypatch.setattr(GameDriver, "set_pace", lambda self, factor: calls.append(factor))
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    bob = client.post(f"/api/rooms/{host['room_id']}/join", json={"name": "B"}).json()
    for tok in (host["player_token"], bob["player_token"]):
        client.post(f"/api/rooms/{host['room_id']}/ready", json={"player_token": tok, "ready": True})

    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws_a, client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
    ) as ws_b:
        ws_a.receive_json()
        ws_b.receive_json()
        client.post(f"/api/rooms/{host['room_id']}/start", json={"player_token": host["player_token"]})
        ws_a.send_json({"type": "set_pace", "factor": 0.45})
        ws_a.send_json({"type": "bogus"})
        while True:
            msg = ws_a.receive_json()
            if msg["type"] == "error":
                break
        # set_pace is silently ignored; the first error is for the bogus message
        assert msg["message"] in ("unknown bogus", "not your turn")
        assert "set_pace" not in msg["message"]
    assert calls == []
