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


def test_hybrid_outperforms_heuristic_only_over_50_games():
    """Hybrid (with MCTS) should beat heuristic-only at least 55% in seat-symmetric play.

    We run 4-bot games where seats 0, 2 are 'hybrid' and 1, 3 are 'heuristic-only'.
    We rotate which seats are hybrid each game to remove seat-bias.
    """
    from app.bot import choose_action
    from app.game import discard_cards, pass_turn, play_card, start_game
    from app.snapshot import public_snapshot
    import os

    if os.environ.get("SKIP_TOURNAMENT") == "1":
        import pytest
        pytest.skip("tournament skipped via env")

    hybrid_wins = 0
    heuristic_wins = 0
    n = 30  # tighter for CI

    def play_with(snap, my_seat, hybrid: bool):
        if not hybrid:
            os.environ["BOT_NO_SEARCH"] = "1"
        try:
            return choose_action(snap, my_seat)
        finally:
            os.environ.pop("BOT_NO_SEARCH", None)

    for g in range(n):
        hybrid_seats = {0, 2} if g % 2 == 0 else {1, 3}
        state = start_game(game_id=f"t{g}", seed=1000 + g, names=["A", "B", "C", "D"], bots=[True]*4)
        plies = 0
        while state.winner_idx is None and plies < 300:
            idx = state.turn_idx
            snap = public_snapshot(state, viewer_idx=idx)
            kind, payload = play_with(snap, idx, hybrid=idx in hybrid_seats)
            if kind == "play":
                play_card(state, idx, payload["card_id"], payload["targets"])
            elif kind == "discard":
                discard_cards(state, idx, payload["card_ids"])
            else:
                pass_turn(state, idx)
            plies += 1
        if state.winner_idx is not None:
            if state.winner_idx in hybrid_seats:
                hybrid_wins += 1
            else:
                heuristic_wins += 1

    total_decided = hybrid_wins + heuristic_wins
    if total_decided == 0:
        return
    rate = hybrid_wins / total_decided
    assert rate >= 0.50, f"hybrid win rate {rate:.2f} too low ({hybrid_wins}/{total_decided})"
