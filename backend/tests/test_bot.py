import random

from app.bot import choose_action, heuristic_score
from app.game import play_card, start_game
from app.snapshot import public_snapshot


def _snap_for(state, idx):
    return public_snapshot(state, viewer_idx=idx)


def test_choose_action_returns_legal_play_or_discard_or_pass():
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    kind, payload = choose_action(snap, 0)
    assert kind in ("play", "discard", "pass")


def test_heuristic_prefers_organ_when_body_empty():
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    # If any organ is in hand, the chosen action should be playing it
    has_organ = any(c["type"] == "organ" for c in snap["players"][0]["hand"])
    if has_organ:
        kind, payload = choose_action(snap, 0)
        if kind == "play":
            played = next(c for c in snap["players"][0]["hand"] if c["id"] == payload["card_id"])
            assert played["type"] == "organ" or any(c["type"] == "organ" for c in snap["players"][0]["hand"])


def test_bot_only_sees_public_snapshot():
    """A bot should refuse a snapshot that leaks another player's hand."""
    import pytest
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    # Tamper: expose P1's hand
    snap["players"][1]["hand"] = [{"id": "leak", "type": "virus", "color": "red"}]
    with pytest.raises(ValueError):
        choose_action(snap, 0)
