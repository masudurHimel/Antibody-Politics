import random

import pytest

from app.game import discard_cards, pass_turn, play_card, start_game
from app.models import GameState
from app.rules import IllegalAction, legal_targets


TOTAL_CARDS = 68  # canonical Virus! deck (see deck.build_deck)


def _live_card_total(state: GameState) -> int:
    """Every card in the system: deck + discard + hands + organ pieces in play + cards attached to organs.

    Each Organ counts as 1 (it represents the played organ Card). When an organ is destroyed
    its card must return to `discard` so this total is conserved.
    """
    total = len(state.deck) + len(state.discard)
    for p in state.players:
        total += len(p.hand) + len(p.body)
        for o in p.body:
            total += len(o.attached)
    return total


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
    assert _live_card_total(state) == TOTAL_CARDS
    while state.winner_idx is None and plies < max_plies:
        idx = state.turn_idx
        kind, cid, tgt = _random_action(state, idx, rng)
        if kind == "play":
            play_card(state, idx, cid, tgt)
        elif kind == "discard":
            discard_cards(state, idx, cid)
        else:
            pass_turn(state, idx)
        assert _live_card_total(state) == TOTAL_CARDS, (
            f"seed={seed} ply={plies}: card total drifted to {_live_card_total(state)}"
        )
        plies += 1
    # either someone won, or we hit the cap (no exceptions thrown)
    assert plies <= max_plies
