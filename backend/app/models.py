from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field


class Color(str, Enum):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"
    YELLOW = "yellow"
    MULTI = "multi"


class CardType(str, Enum):
    ORGAN = "organ"
    VIRUS = "virus"
    MEDICINE = "medicine"
    TREATMENT = "treatment"


class TreatmentKind(str, Enum):
    TRANSPLANT = "transplant"
    ORGAN_THIEF = "organ_thief"
    CONTAGION = "contagion"
    LATEX_GLOVE = "latex_glove"
    MEDICAL_ERROR = "medical_error"


class OrganStatus(str, Enum):
    FREE = "free"
    VACCINATED = "vaccinated"
    INFECTED = "infected"
    IMMUNIZED = "immunized"


class Card(BaseModel):
    id: str
    type: CardType
    color: Color
    treatment_kind: Optional[TreatmentKind] = None

    def matches_color(self, other: Color) -> bool:
        return self.color == Color.MULTI or other == Color.MULTI or self.color == other


class Organ(BaseModel):
    id: str
    color: Color
    attached: list[Card] = Field(default_factory=list)

    @computed_field  # type: ignore[misc]
    @property
    def status(self) -> OrganStatus:
        viruses = [c for c in self.attached if c.type == CardType.VIRUS]
        medicines = [c for c in self.attached if c.type == CardType.MEDICINE]
        if len(medicines) >= 2:
            return OrganStatus.IMMUNIZED
        if len(medicines) == 1 and not viruses:
            return OrganStatus.VACCINATED
        if len(viruses) == 1 and not medicines:
            return OrganStatus.INFECTED
        return OrganStatus.FREE


def _has_distinct_winning_set(colors: list[Color]) -> bool:
    """4 healthy organs of distinct colors, MULTI fills any missing color.

    A body may hold 5 organs (4 colors + multi); any 4 distinct healthy ones win.
    """
    if len(colors) < 4:
        return False
    plain = [c for c in colors if c != Color.MULTI]
    multis = len(colors) - len(plain)
    if len(set(plain)) != len(plain):
        return False
    if multis == 0:
        return len(set(plain)) >= 4
    needed = 4 - len(plain)
    return multis >= needed


class Player(BaseModel):
    idx: int
    name: str
    is_bot: bool
    hand: list[Card] = Field(default_factory=list)
    body: list[Organ] = Field(default_factory=list)

    def has_won(self) -> bool:
        healthy = [o for o in self.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
        return _has_distinct_winning_set([o.color for o in healthy])


class GameState(BaseModel):
    game_id: str
    seed: int
    players: list[Player]
    deck: list[Card] = Field(default_factory=list)
    discard: list[Card] = Field(default_factory=list)
    turn_idx: int = 0
    winner_idx: Optional[int] = None
    event_log: list[str] = Field(default_factory=list)
