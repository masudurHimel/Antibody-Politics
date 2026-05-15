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


def test_play_virus_on_free_organ_infects_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[1].body.append(organ)
    virus = _card("v-r-0", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.INFECTED


def test_play_virus_on_infected_organ_destroys_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("v-r-existing", CardType.VIRUS, Color.RED)])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ not in s.players[1].body
    # all 3 cards (organ as a card? no — organ is removed; both viruses go to discard)
    discard_ids = {c.id for c in s.discard}
    assert "v-r-existing" in discard_ids
    assert "v-r-1" in discard_ids


def test_play_virus_on_vaccinated_organ_removes_medicine_back_to_free():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m-r-existing", CardType.MEDICINE, Color.RED)])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE
    discard_ids = {c.id for c in s.discard}
    assert {"m-r-existing", "v-r-1"} <= discard_ids


def test_play_virus_on_immunized_is_illegal():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED),
        _card("m2", CardType.MEDICINE, Color.RED),
    ])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})


def test_play_medicine_on_free_organ_vaccinates_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[0].body.append(organ)
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.VACCINATED


def test_play_medicine_on_vaccinated_organ_immunizes_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m1", CardType.MEDICINE, Color.RED)])
    s.players[0].body.append(organ)
    med2 = _card("m2", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med2)
    apply_play(s, 0, med2.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.IMMUNIZED


def test_play_medicine_on_infected_organ_cures_to_free():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("v1", CardType.VIRUS, Color.RED)])
    s.players[0].body.append(organ)
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE
    discard_ids = {c.id for c in s.discard}
    assert {"v1", "m-r-0"} <= discard_ids


def test_play_medicine_on_immunized_is_illegal():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED),
        _card("m2", CardType.MEDICINE, Color.RED),
    ])
    s.players[0].body.append(organ)
    med3 = _card("m3", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med3)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, med3.id, {"player": 0, "organ_id": "o-r"})


def test_multi_virus_can_target_any_organ_color():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[1].body.append(organ)
    virus = _card("v-multi", CardType.VIRUS, Color.MULTI)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.INFECTED


def test_legal_targets_virus_lists_all_non_immunized_color_matching_organs():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-r", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[3].body.append(Organ(id="o-r2", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED), _card("m2", CardType.MEDICINE, Color.RED),
    ]))  # immunized
    virus = _card("v-r-0", CardType.VIRUS, Color.RED)
    targets = legal_targets(s, 0, virus)
    target_pairs = {(t["player"], t["organ_id"]) for t in targets}
    assert (1, "o-r") in target_pairs
    assert (2, "o-b") not in target_pairs  # color mismatch
    assert (3, "o-r2") not in target_pairs  # immunized
