from collections import Counter

from app.deck import build_deck, draw_one
from app.models import CardType, Color, TreatmentKind


def test_total_card_count_is_68():
    deck = build_deck()
    assert len(deck) == 68


def test_organ_distribution():
    deck = build_deck()
    organs = [c for c in deck if c.type == CardType.ORGAN]
    assert len(organs) == 21
    by_color = Counter(c.color for c in organs)
    assert by_color[Color.RED] == 5
    assert by_color[Color.GREEN] == 5
    assert by_color[Color.BLUE] == 5
    assert by_color[Color.YELLOW] == 5
    assert by_color[Color.MULTI] == 1


def test_virus_distribution():
    deck = build_deck()
    viruses = [c for c in deck if c.type == CardType.VIRUS]
    assert len(viruses) == 17
    by_color = Counter(c.color for c in viruses)
    assert by_color[Color.RED] == 4
    assert by_color[Color.GREEN] == 4
    assert by_color[Color.BLUE] == 4
    assert by_color[Color.YELLOW] == 4
    assert by_color[Color.MULTI] == 1


def test_medicine_distribution():
    deck = build_deck()
    meds = [c for c in deck if c.type == CardType.MEDICINE]
    assert len(meds) == 20
    by_color = Counter(c.color for c in meds)
    assert by_color[Color.RED] == 4
    assert by_color[Color.GREEN] == 4
    assert by_color[Color.BLUE] == 4
    assert by_color[Color.YELLOW] == 4
    assert by_color[Color.MULTI] == 4


def test_treatment_distribution():
    deck = build_deck()
    treats = [c for c in deck if c.type == CardType.TREATMENT]
    assert len(treats) == 10
    by_kind = Counter(c.treatment_kind for c in treats)
    assert by_kind[TreatmentKind.TRANSPLANT] == 3
    assert by_kind[TreatmentKind.ORGAN_THIEF] == 1
    assert by_kind[TreatmentKind.CONTAGION] == 2
    assert by_kind[TreatmentKind.LATEX_GLOVE] == 1
    assert by_kind[TreatmentKind.MEDICAL_ERROR] == 3


def test_card_ids_are_unique():
    deck = build_deck()
    ids = [c.id for c in deck]
    assert len(set(ids)) == len(ids)


def test_draw_one_flips_discard_when_deck_empty():
    # Rulebook: the discard pile is flipped to form the new deck — no reshuffle.
    deck = []
    discard = build_deck()
    bottom_id = discard[0].id
    expected = list(reversed(discard))  # bottom of the discard pile becomes the deck's top
    card = draw_one(deck, discard)
    assert card is not None
    assert card.id == bottom_id
    assert len(discard) == 0
    assert len(deck) == 67  # 68 flipped, 1 drawn
    assert deck == expected[:-1]


def test_draw_one_returns_none_when_deck_and_discard_empty():
    assert draw_one([], []) is None
