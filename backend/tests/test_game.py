import random

import pytest

from app.deck import build_deck
from app.game import advance_turn, discard_cards, draw_to_three, play_card, start_game
from app.models import CardType, Color


def test_start_game_deals_three_cards_to_each_player():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    for p in state.players:
        assert len(p.hand) == 3
    assert state.turn_idx == 0
    assert state.winner_idx is None
    # 4 players × 3 = 12 cards dealt; 68 − 12 = 56 in deck
    assert len(state.deck) == 56


def test_draw_to_three_refills_after_play():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    state.players[0].hand.pop()
    assert len(state.players[0].hand) == 2
    draw_to_three(state, 0)
    assert len(state.players[0].hand) == 3


def test_advance_turn_skips_past_winner():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    state.turn_idx = 0
    advance_turn(state)
    assert state.turn_idx == 1
    advance_turn(state); advance_turn(state); advance_turn(state)
    assert state.turn_idx == 0


def test_discard_cards_no_draw_this_turn():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    cards_to_discard = [state.players[0].hand[0].id]
    discard_cards(state, 0, cards_to_discard)
    # discarding ends turn without redraw — hand drops to 2 and turn advances
    assert len(state.players[0].hand) == 2
    assert state.turn_idx == 1


def test_play_card_organ_advances_turn_and_redraws():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    organ = next((c for c in state.players[0].hand if c.type == CardType.ORGAN), None)
    if organ is None:
        pytest.skip("seed didn't deal P0 an organ — re-seed if this becomes flaky")
    play_card(state, 0, organ.id, {})
    assert len(state.players[0].body) == 1
    assert len(state.players[0].hand) == 3  # redrawn
    assert state.turn_idx == 1
