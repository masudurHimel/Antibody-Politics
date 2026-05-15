from __future__ import annotations

import random
from typing import Optional

from .models import Card, CardType, Color, TreatmentKind

_COLORED = [Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW]


def _add(out: list[Card], type_: CardType, color: Color, count: int, *, treatment_kind: Optional[TreatmentKind] = None) -> None:
    prefix = type_.value[0] if treatment_kind is None else f"t-{treatment_kind.value}"
    base = sum(1 for c in out if c.type == type_ and c.color == color and c.treatment_kind == treatment_kind)
    for i in range(count):
        cid = f"{prefix}-{color.value}-{base + i}"
        out.append(Card(id=cid, type=type_, color=color, treatment_kind=treatment_kind))


def build_deck() -> list[Card]:
    deck: list[Card] = []

    # Organs: 5 of each color + 1 multi
    for color in _COLORED:
        _add(deck, CardType.ORGAN, color, 5)
    _add(deck, CardType.ORGAN, Color.MULTI, 1)

    # Viruses: 4 of each color + 1 multi
    for color in _COLORED:
        _add(deck, CardType.VIRUS, color, 4)
    _add(deck, CardType.VIRUS, Color.MULTI, 1)

    # Medicines: 4 of each color + 4 multi
    for color in _COLORED:
        _add(deck, CardType.MEDICINE, color, 4)
    _add(deck, CardType.MEDICINE, Color.MULTI, 4)

    # Treatments: 3 Transplant, 1 Organ Thief, 2 Contagion, 1 Latex Glove, 3 Medical Error
    _add(deck, CardType.TREATMENT, Color.MULTI, 3, treatment_kind=TreatmentKind.TRANSPLANT)
    _add(deck, CardType.TREATMENT, Color.MULTI, 1, treatment_kind=TreatmentKind.ORGAN_THIEF)
    _add(deck, CardType.TREATMENT, Color.MULTI, 2, treatment_kind=TreatmentKind.CONTAGION)
    _add(deck, CardType.TREATMENT, Color.MULTI, 1, treatment_kind=TreatmentKind.LATEX_GLOVE)
    _add(deck, CardType.TREATMENT, Color.MULTI, 3, treatment_kind=TreatmentKind.MEDICAL_ERROR)

    return deck


def shuffle_into(deck: list[Card], discard: list[Card], rng: random.Random) -> None:
    """When the deck is empty, fold the discard back into it (shuffled)."""
    if deck:
        return
    rng.shuffle(discard)
    deck.extend(discard)
    discard.clear()


def draw_one(deck: list[Card], discard: list[Card], rng: random.Random) -> Optional[Card]:
    if not deck:
        shuffle_into(deck, discard, rng)
    if not deck:
        return None
    return deck.pop()
