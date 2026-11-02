from app.models import (
    Card, Color, CardType, Organ, OrganStatus, Player, TreatmentKind,
)


def make_card(**kw):
    defaults = dict(id="c1", type=CardType.VIRUS, color=Color.RED)
    defaults.update(kw)
    return Card(**defaults)


def test_organ_status_free_when_no_attached():
    o = Organ(id="o1", color=Color.RED, attached=[])
    assert o.status == OrganStatus.FREE


def test_organ_status_infected_with_one_virus():
    o = Organ(id="o1", color=Color.RED, attached=[make_card(type=CardType.VIRUS, color=Color.RED)])
    assert o.status == OrganStatus.INFECTED


def test_organ_status_vaccinated_with_one_medicine():
    o = Organ(id="o1", color=Color.RED, attached=[make_card(type=CardType.MEDICINE, color=Color.RED)])
    assert o.status == OrganStatus.VACCINATED


def test_organ_status_immunized_with_two_medicines():
    o = Organ(id="o1", color=Color.RED, attached=[
        make_card(id="m1", type=CardType.MEDICINE, color=Color.RED),
        make_card(id="m2", type=CardType.MEDICINE, color=Color.MULTI),
    ])
    assert o.status == OrganStatus.IMMUNIZED


def test_has_won_requires_four_distinct_colors_healthy():
    body = [
        Organ(id=f"o{i}", color=c, attached=[])
        for i, c in enumerate([Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW])
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()


def test_has_won_false_with_three_distinct_plus_duplicate():
    body = [
        Organ(id="o0", color=Color.RED, attached=[]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.BLUE, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert not p.has_won()


def test_has_won_multi_organ_satisfies_missing_color():
    body = [
        Organ(id="o0", color=Color.RED, attached=[]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.MULTI, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()


def test_has_won_false_with_infected_organ():
    body = [
        Organ(id="o0", color=Color.RED, attached=[make_card(type=CardType.VIRUS, color=Color.RED)]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.YELLOW, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert not p.has_won()


def test_has_won_with_five_healthy_organs():
    body = [
        Organ(id=f"o{i}", color=c, attached=[])
        for i, c in enumerate([Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW, Color.MULTI])
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()


def test_has_won_with_five_organs_multi_covers_infected_color():
    body = [
        Organ(id="o0", color=Color.RED, attached=[make_card(type=CardType.VIRUS, color=Color.RED)]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.YELLOW, attached=[]),
        Organ(id="o4", color=Color.MULTI, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()
