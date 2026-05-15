import random

import pytest

from app.game import discard_cards, pass_turn, play_card, start_game
from app.rules import IllegalAction, legal_targets


def _random_action(state, idx, rng: random.Random):
    p = state.players[idx]
    # try each card in hand in random order
    cards = list(p.hand)
    rng.shuffle(cards)
    for c in cards:
        try:
            tgts = legal_targets(state, idx, c)
        except IllegalAction:
            continue
        if not tgts:
            continue
        return ("play", c.id, rng.choice(tgts))
    # fallback: discard 1 card (if any) else pass
    if p.hand:
        return ("discard", [rng.choice(p.hand).id], None)
    return ("pass", None, None)


@pytest.mark.parametrize("seed", range(50))
def test_random_policy_game_terminates_or_progresses(seed: int):
    state = start_game(game_id=f"g{seed}", seed=seed, names=["A", "B", "C", "D"], bots=[True]*4)
    rng = random.Random(seed)
    plies = 0
    max_plies = 400
    while state.winner_idx is None and plies < max_plies:
        idx = state.turn_idx
        kind, cid, tgt = _random_action(state, idx, rng)
        if kind == "play":
            play_card(state, idx, cid, tgt)
        elif kind == "discard":
            discard_cards(state, idx, cid)
        else:
            pass_turn(state, idx)
        plies += 1
    # either someone won, or we hit the cap (no exceptions thrown)
    assert plies <= max_plies
