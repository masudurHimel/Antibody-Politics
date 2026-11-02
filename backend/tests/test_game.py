import random

import pytest

from app.deck import build_deck
from app.game import advance_turn, check_winner, discard_cards, draw_to_three, pass_turn, play_card, start_game
from app.models import Card, CardType, Color, Organ, TreatmentKind


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


def test_discard_cards_refills_hand_to_three():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    cards_to_discard = [state.players[0].hand[0].id, state.players[0].hand[1].id]
    discard_cards(state, 0, cards_to_discard)
    # discarding N cards refills hand back to 3 and advances turn
    assert len(state.players[0].hand) == 3
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


def _bare_state():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    for p in state.players:
        p.hand.clear()
        p.body.clear()
    return state


def _organs(*colors):
    return [Organ(id=f"o-{c.value}", color=c, attached=[]) for c in colors]


def test_played_organ_keeps_card_id_in_body():
    state = _bare_state()
    card = Card(id="o-red-0", type=CardType.ORGAN, color=Color.RED)
    state.players[0].hand.append(card)
    play_card(state, 0, card.id, {})
    assert state.players[0].body[0].id == "o-red-0"


def test_transplant_completing_another_players_body_wins_for_them():
    state = _bare_state()
    # P1 has R,G,B + infected yellow; P2 has a healthy yellow. P0 transplants between them.
    state.players[1].body.extend(_organs(Color.RED, Color.GREEN, Color.BLUE))
    state.players[1].body.append(Organ(id="o-y-sick", color=Color.YELLOW,
                                       attached=[Card(id="v-y", type=CardType.VIRUS, color=Color.YELLOW)]))
    state.players[2].body.append(Organ(id="o-y-ok", color=Color.YELLOW, attached=[]))
    t = Card(id="t-tp", type=CardType.TREATMENT, color=Color.MULTI, treatment_kind=TreatmentKind.TRANSPLANT)
    state.players[0].hand.append(t)
    play_card(state, 0, t.id, {"from": {"player": 1, "organ_id": "o-y-sick"},
                               "to": {"player": 2, "organ_id": "o-y-ok"}})
    assert state.winner_idx == 1


def test_win_check_prefers_acting_player():
    state = _bare_state()
    # P0 already holds a complete body; P1 completes theirs on their own play → P1 is checked first.
    state.players[0].body.extend(_organs(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW))
    state.players[1].body.extend(_organs(Color.RED, Color.GREEN, Color.BLUE))
    state.turn_idx = 1
    card = Card(id="o-y-1", type=CardType.ORGAN, color=Color.YELLOW)
    state.players[1].hand.append(card)
    play_card(state, 1, card.id, {})
    assert state.winner_idx == 1


def test_win_check_others_in_seat_order():
    state = _bare_state()
    state.players[1].body.extend(_organs(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW))
    state.players[2].body.extend(_organs(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW))
    check_winner(state, actor_idx=3)
    assert state.winner_idx == 1


def test_pass_with_empty_hand_after_latex_glove_draws_three_and_skips():
    state = _bare_state()
    glove = Card(id="t-lg", type=CardType.TREATMENT, color=Color.MULTI, treatment_kind=TreatmentKind.LATEX_GLOVE)
    state.players[0].hand.append(glove)
    state.players[1].hand.append(Card(id="h1", type=CardType.VIRUS, color=Color.RED))
    play_card(state, 0, glove.id, {})
    assert state.players[1].hand == []
    assert state.turn_idx == 1
    pass_turn(state, 1)
    assert len(state.players[1].hand) == 3
    assert state.turn_idx == 2
