import json
import time

from fastapi.testclient import TestClient

from app.main import app


def test_ws_emits_initial_snapshot_on_connect():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    with client.websocket_connect(f"/ws/games/{created['game_id']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "snapshot"
        assert msg["snapshot"]["game_id"] == created["game_id"]


def test_ws_play_round_trip_advances_to_bot_turn():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    gid = created["game_id"]
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        snap = ws.receive_json()["snapshot"]
        # find any organ in hand to play
        organ = next((c for c in snap["players"][0]["hand"] if c["type"] == "organ"), None)
        if organ is None:
            # discard a card instead
            ws.send_json({"type": "discard", "card_ids": [snap["players"][0]["hand"][0]["id"]]})
        else:
            ws.send_json({"type": "play", "card_id": organ["id"], "targets": {}})
        # We expect: an action message, then bot_thinking, then bot action(s), then back to our turn
        seen_action = False
        seen_bot_thinking = False
        deadline = time.time() + 8.0
        while time.time() < deadline:
            msg = ws.receive_json()
            if msg["type"] == "action" and msg["player"] == 0:
                seen_action = True
            if msg["type"] == "bot_thinking":
                seen_bot_thinking = True
                break
        assert seen_action
        assert seen_bot_thinking


def test_ws_solo_set_pace_reaches_driver(monkeypatch):
    from app.driver import GameDriver
    calls = []
    monkeypatch.setattr(GameDriver, "set_pace", lambda self, factor: calls.append(factor))
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    with client.websocket_connect(f"/ws/games/{created['game_id']}") as ws:
        ws.receive_json()  # snapshot
        ws.send_json({"type": "set_pace", "factor": 1.7})
        ws.send_json({"type": "bogus"})
        while True:
            msg = ws.receive_json()
            if msg["type"] == "error":
                break
        assert msg["message"] == "unknown bogus", "set_pace must not produce an error"
    assert calls == [1.7]
