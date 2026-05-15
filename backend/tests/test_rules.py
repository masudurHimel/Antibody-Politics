import random

import pytest

from app.deck import build_deck
from app.models import (
    Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind,
)
from app.rules import IllegalAction, apply_play, legal_targets


def _empty_state() -> GameState:
    players = [
        Player(idx=i, name=f"P{i}", is_bot=(i != 0), hand=[], body=[]) for i in range(4)
    ]
    return GameState(game_id="g1", seed=1, players=players, deck=[], discard=[])


def _card(id_: str, type_: CardType, color: Color, *, tk: TreatmentKind | None = None) -> Card:
    return Card(id=id_, type=type_, color=color, treatment_kind=tk)


def test_play_organ_into_empty_body():
    s = _empty_state()
    organ_card = _card("org-r-0", CardType.ORGAN, Color.RED)
    s.players[0].hand.append(organ_card)
    events = apply_play(s, 0, organ_card.id, {})
    assert len(s.players[0].body) == 1
    assert s.players[0].body[0].color == Color.RED
    assert s.players[0].body[0].id != organ_card.id  # organs get a fresh body id
    assert organ_card not in s.players[0].hand
    assert any("Red organ" in e or "organ" in e.lower() for e in events)


def test_play_duplicate_color_organ_is_illegal():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-existing", color=Color.RED, attached=[]))
    organ_card = _card("org-r-1", CardType.ORGAN, Color.RED)
    s.players[0].hand.append(organ_card)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, organ_card.id, {})


def test_legal_targets_for_organ_is_single_empty_dict():
    s = _empty_state()
    organ = _card("org-r-0", CardType.ORGAN, Color.RED)
    assert legal_targets(s, 0, organ) == [{}]


def test_legal_targets_for_organ_blocked_when_duplicate_color_in_body():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-existing", color=Color.RED, attached=[]))
    organ = _card("org-r-0", CardType.ORGAN, Color.RED)
    assert legal_targets(s, 0, organ) == []
