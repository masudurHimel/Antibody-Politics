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
    assert s.players[0].body[0].id == organ_card.id  # one physical card keeps one id hand → body
    assert organ_card not in s.players[0].hand
    assert any("placed a Heart" in e for e in events)


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
    # both viruses AND the organ card itself go to discard (Virus! rule: destroyed organs return to circulation)
    discard_ids = {c.id for c in s.discard}
    assert "v-r-existing" in discard_ids
    assert "v-r-1" in discard_ids
    discarded_organs = [c for c in s.discard if c.type == CardType.ORGAN and c.color == Color.RED]
    assert len(discarded_organs) == 1, "destroyed organ must return to discard so the deck can recycle it"
    assert discarded_organs[0].id == "o-r", "destroyed organ card keeps its id body → discard"


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


def test_play_medicine_on_opponent_vaccinates_it():
    # Official FAQ: medicine may be played on any player's organ.
    s = _empty_state()
    opp_organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[1].body.append(opp_organ)
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 1, "organ_id": "o-r"})
    assert opp_organ.status == OrganStatus.VACCINATED


def test_legal_targets_for_medicine_includes_opponent_organs():
    from app.rules import legal_targets
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-self", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-opp", color=Color.RED, attached=[]))
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    targets = legal_targets(s, 0, med)
    assert targets == [{"player": 0, "organ_id": "o-self"}, {"player": 1, "organ_id": "o-opp"}]


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


# --- TRANSPLANT ---

def test_transplant_swaps_two_organs():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})
    assert s.players[0].body[0].id == "o-b"
    assert s.players[1].body[0].id == "o-a"


def test_transplant_illegal_if_either_organ_immunized():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})


def test_transplant_illegal_if_creates_duplicate_color():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[1].body.append(Organ(id="o-c", color=Color.RED, attached=[]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    # transplant o-a (red) ↔ o-b (blue) would put a 2nd red in P1's body (it already has o-c red)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})


# --- ORGAN THIEF ---

def test_organ_thief_moves_organ_to_self():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})
    assert any(o.id == "o-b" for o in s.players[0].body)
    assert not any(o.id == "o-b" for o in s.players[1].body)


def test_organ_thief_illegal_when_thief_would_have_duplicate():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-blue-own", color=Color.BLUE, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})


def test_organ_thief_illegal_on_immunized():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})


# --- LATEX GLOVE ---

def test_latex_glove_discards_other_players_hands():
    s = _empty_state()
    s.players[1].hand.extend([_card("h1", CardType.VIRUS, Color.RED), _card("h2", CardType.MEDICINE, Color.BLUE)])
    s.players[2].hand.append(_card("h3", CardType.ORGAN, Color.GREEN))
    s.players[0].hand.append(_card("hkeep", CardType.MEDICINE, Color.GREEN))
    t = _card("t-3", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.LATEX_GLOVE)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert s.players[1].hand == []
    assert s.players[2].hand == []
    assert any(c.id == "hkeep" for c in s.players[0].hand)
    discard_ids = {c.id for c in s.discard}
    assert {"h1", "h2", "h3", "t-3"} <= discard_ids


# --- MEDICAL ERROR ---

def test_medical_error_swaps_full_bodies():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[2].body.append(Organ(id="o-c", color=Color.GREEN, attached=[]))
    t = _card("t-4", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.MEDICAL_ERROR)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 2})
    p0_ids = {o.id for o in s.players[0].body}
    p2_ids = {o.id for o in s.players[2].body}
    assert p0_ids == {"o-b", "o-c"}
    assert p2_ids == {"o-a"}


def test_medical_error_swaps_even_with_immunized_organs():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-4", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.MEDICAL_ERROR)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 2})
    assert any(o.id == "o-b" for o in s.players[0].body)


# --- CONTAGION ---

def test_contagion_transfers_each_virus_to_first_matching_free_organ():
    s = _empty_state()
    # P0 has two infected organs
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vR", CardType.VIRUS, Color.RED)]))
    s.players[0].body.append(Organ(id="o-b", color=Color.BLUE, attached=[_card("vB", CardType.VIRUS, Color.BLUE)]))
    # P1 has a free red
    s.players[1].body.append(Organ(id="o-r1", color=Color.RED, attached=[]))
    # P2 has a free blue
    s.players[2].body.append(Organ(id="o-b2", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    # P0's organs go back to FREE; P1.red & P2.blue become INFECTED
    assert s.players[0].body[0].status == OrganStatus.FREE
    assert s.players[0].body[1].status == OrganStatus.FREE
    assert s.players[1].body[0].status == OrganStatus.INFECTED
    assert s.players[2].body[0].status == OrganStatus.INFECTED


def test_contagion_skips_when_no_matching_target():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vR", CardType.VIRUS, Color.RED)]))
    # No other player has a free RED — virus stays
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert s.players[0].body[0].status == OrganStatus.INFECTED
    assert s.players[1].body[0].status == OrganStatus.FREE


# --- OFFICIAL RULINGS (Tranjis FAQ / rulebook) ---

def _full_colored_body() -> list[Organ]:
    return [Organ(id=f"o-{c.value}", color=c, attached=[]) for c in (Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW)]


def test_multi_organ_can_be_fifth_organ():
    s = _empty_state()
    s.players[0].body.extend(_full_colored_body())
    multi = _card("org-multi", CardType.ORGAN, Color.MULTI)
    s.players[0].hand.append(multi)
    assert legal_targets(s, 0, multi) == [{}]
    apply_play(s, 0, multi.id, {})
    assert len(s.players[0].body) == 5


def test_second_multi_organ_is_illegal():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-m", color=Color.MULTI, attached=[]))
    multi = _card("org-multi-2", CardType.ORGAN, Color.MULTI)
    s.players[0].hand.append(multi)
    assert legal_targets(s, 0, multi) == []
    with pytest.raises(IllegalAction):
        apply_play(s, 0, multi.id, {})


def test_organ_thief_can_steal_multi_as_fifth_organ():
    s = _empty_state()
    s.players[0].body.extend(_full_colored_body())
    s.players[1].body.append(Organ(id="o-m", color=Color.MULTI, attached=[]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    assert {"player": 1, "organ_id": "o-m"} in legal_targets(s, 0, t)
    apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-m"})
    assert len(s.players[0].body) == 5


def test_virus_must_match_medicine_to_neutralize():
    # multi organ vaccinated with red medicine: a blue virus matches the organ but not the medicine
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-m", color=Color.MULTI, attached=[_card("m-r", CardType.MEDICINE, Color.RED)]))
    virus = _card("v-b", CardType.VIRUS, Color.BLUE)
    s.players[0].hand.append(virus)
    assert {"player": 1, "organ_id": "o-m"} not in legal_targets(s, 0, virus)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-m"})
    assert virus in s.players[0].hand


def test_virus_matching_medicine_neutralizes():
    s = _empty_state()
    organ = Organ(id="o-m", color=Color.MULTI, attached=[_card("m-r", CardType.MEDICINE, Color.RED)])
    s.players[1].body.append(organ)
    virus = _card("v-r", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-m"})
    assert organ.status == OrganStatus.FREE


def test_any_virus_neutralizes_multi_medicine_on_matching_organ():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m-m", CardType.MEDICINE, Color.MULTI)])
    s.players[1].body.append(organ)
    virus = _card("v-r", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE


def test_medicine_must_match_virus_to_cure():
    # multi organ infected with red virus: a blue medicine matches the organ but not the virus
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-m", color=Color.MULTI, attached=[_card("v-r", CardType.VIRUS, Color.RED)]))
    med = _card("m-b", CardType.MEDICINE, Color.BLUE)
    s.players[0].hand.append(med)
    assert {"player": 0, "organ_id": "o-m"} not in legal_targets(s, 0, med)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-m"})
    assert med in s.players[0].hand


def test_medicine_matching_multi_virus_cures():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("v-m", CardType.VIRUS, Color.MULTI)])
    s.players[0].body.append(organ)
    med = _card("m-r", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE


def test_immunize_requires_organ_color_not_existing_medicine_color():
    # FAQ: red organ + multicolor medicine is immunized only by red or multicolor medicine
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m-m", CardType.MEDICINE, Color.MULTI)])
    s.players[0].body.append(organ)
    blue = _card("m-b", CardType.MEDICINE, Color.BLUE)
    red = _card("m-r", CardType.MEDICINE, Color.RED)
    s.players[0].hand.extend([blue, red])
    assert {"player": 0, "organ_id": "o-r"} not in legal_targets(s, 0, blue)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, blue.id, {"player": 0, "organ_id": "o-r"})
    apply_play(s, 0, red.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.IMMUNIZED


def test_transplant_between_two_other_players():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    targets = {"from": {"player": 1, "organ_id": "o-a"}, "to": {"player": 2, "organ_id": "o-b"}}
    assert targets in legal_targets(s, 0, t)
    apply_play(s, 0, t.id, targets)
    assert [o.id for o in s.players[1].body] == ["o-b"]
    assert [o.id for o in s.players[2].body] == ["o-a"]


def test_contagion_moves_multi_virus_onto_any_color():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vM", CardType.VIRUS, Color.MULTI)]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert s.players[0].body[0].status == OrganStatus.FREE
    assert s.players[1].body[0].status == OrganStatus.INFECTED


def test_contagion_maximizes_viruses_moved():
    """Rulebook: transfer *as many viruses as you can*. A greedy first-fit would send the
    multi virus to the only red target and strand the red virus."""
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-g", color=Color.GREEN, attached=[_card("vM", CardType.VIRUS, Color.MULTI)]))
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vR", CardType.VIRUS, Color.RED)]))
    s.players[1].body.append(Organ(id="o-r1", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b1", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert all(o.status == OrganStatus.FREE for o in s.players[0].body)
    assert all(o.status == OrganStatus.INFECTED for o in s.players[1].body)
    assert [c.id for c in s.players[1].body[0].attached] == ["vR"]
