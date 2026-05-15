from app.game import start_game
from app.snapshot import public_snapshot


def test_snapshot_hides_other_hands_but_includes_count():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=0)
    assert snap["viewer_idx"] == 0
    assert snap["players"][0]["hand"] is not None
    assert len(snap["players"][0]["hand"]) == 3
    for i in (1, 2, 3):
        assert snap["players"][i]["hand"] is None
        assert snap["players"][i]["hand_count"] == 3


def test_snapshot_includes_event_log_and_counts():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=0)
    assert snap["deck_count"] == 56
    assert snap["discard_count"] == 0
    assert "Game started" in snap["event_log"]


def test_snapshot_from_bot_viewpoint_does_not_leak_human_hand():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=1)
    assert snap["players"][0]["hand"] is None
    assert snap["players"][1]["hand"] is not None
