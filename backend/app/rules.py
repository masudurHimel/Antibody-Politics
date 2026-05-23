from __future__ import annotations

import uuid
from typing import Any

from .models import (
    Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind,
)


class IllegalAction(Exception):
    pass


# ---- helpers --------------------------------------------------------------

def _pop_card_from_hand(player: Player, card_id: str) -> Card:
    for i, c in enumerate(player.hand):
        if c.id == card_id:
            return player.hand.pop(i)
    raise IllegalAction(f"card {card_id} not in hand of P{player.idx}")


def _find_organ(player: Player, organ_id: str) -> Organ:
    for o in player.body:
        if o.id == organ_id:
            return o
    raise IllegalAction(f"organ {organ_id} not in P{player.idx} body")


def _body_colors(player: Player) -> set[Color]:
    return {o.color for o in player.body}


def _organ_color_matches(card_color: Color, organ_color: Color) -> bool:
    return card_color == Color.MULTI or organ_color == Color.MULTI or card_color == organ_color


# ---- public API -----------------------------------------------------------

def legal_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    if card.type == CardType.ORGAN:
        return _legal_organ_targets(state, player_idx, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _legal_attach_targets(state, card)
    if card.type == CardType.TREATMENT:
        return _legal_treatment_targets(state, player_idx, card)
    raise IllegalAction(f"legal_targets not implemented for card type {card.type}")


def apply_play(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game already won")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")

    player = state.players[player_idx]
    card = next((c for c in player.hand if c.id == card_id), None)
    if card is None:
        raise IllegalAction(f"card {card_id} not in hand")

    if card.type == CardType.ORGAN:
        return _apply_organ(state, player, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _apply_attach(state, player, card, targets)
    if card.type == CardType.TREATMENT:
        return _apply_treatment(state, player, card, targets)
    raise IllegalAction(f"apply_play not implemented for card type {card.type}")


# ---- organ ----------------------------------------------------------------

def _legal_organ_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    body_colors = _body_colors(state.players[player_idx])
    if card.color != Color.MULTI and card.color in body_colors:
        return []
    if card.color == Color.MULTI and Color.MULTI in body_colors:
        return []
    if len(state.players[player_idx].body) >= 4:
        return []
    return [{}]


def _apply_organ(state: GameState, player: Player, card: Card) -> list[str]:
    body_colors = _body_colors(player)
    if card.color != Color.MULTI and card.color in body_colors:
        raise IllegalAction(f"P{player.idx} already has a {card.color.value} organ")
    if card.color == Color.MULTI and Color.MULTI in body_colors:
        raise IllegalAction(f"P{player.idx} already has a multi organ")
    if len(player.body) >= 4:
        raise IllegalAction("body already has 4 organs")

    _pop_card_from_hand(player, card.id)
    organ = Organ(id=f"organ-{uuid.uuid4().hex[:8]}", color=card.color, attached=[])
    player.body.append(organ)
    return [f"P{player.idx} placed a {card.color.value} organ"]


# ---- virus / medicine ----------------------------------------------------

def _legal_attach_targets(state: GameState, card: Card) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in state.players:
        for o in p.body:
            if o.status == OrganStatus.IMMUNIZED:
                continue
            if not _organ_color_matches(card.color, o.color):
                continue
            out.append({"player": p.idx, "organ_id": o.id})
    return out


def _apply_attach(state: GameState, source: Player, card: Card, targets: dict[str, Any]) -> list[str]:
    if "player" not in targets or "organ_id" not in targets:
        raise IllegalAction("attach card requires {player, organ_id}")
    target_player = state.players[targets["player"]]
    organ = _find_organ(target_player, targets["organ_id"])
    if organ.status == OrganStatus.IMMUNIZED:
        raise IllegalAction("organ is immunized")
    if not _organ_color_matches(card.color, organ.color):
        raise IllegalAction("color mismatch")

    _pop_card_from_hand(source, card.id)

    events: list[str] = []
    if card.type == CardType.VIRUS:
        if organ.status == OrganStatus.VACCINATED:
            # remove the medicine, organ returns to FREE; both medicine and virus go to discard
            med = next(c for c in organ.attached if c.type == CardType.MEDICINE)
            organ.attached.remove(med)
            state.discard.append(med)
            state.discard.append(card)
            events.append(f"P{source.idx} virus stripped P{target_player.idx}'s {organ.color.value} vaccine")
        elif organ.status == OrganStatus.INFECTED:
            # destroy organ — both viruses AND the organ card itself go to discard so the deck can recycle them
            for c in list(organ.attached):
                state.discard.append(c)
            state.discard.append(card)
            state.discard.append(Card(id=f"organ-{uuid.uuid4().hex[:8]}", type=CardType.ORGAN, color=organ.color))
            target_player.body.remove(organ)
            events.append(f"P{source.idx} destroyed P{target_player.idx}'s {organ.color.value} organ")
        else:  # FREE
            organ.attached.append(card)
            events.append(f"P{source.idx} infected P{target_player.idx}'s {organ.color.value} organ")
    elif card.type == CardType.MEDICINE:
        if organ.status == OrganStatus.IMMUNIZED:
            raise IllegalAction("organ is already immunized")
        if organ.status == OrganStatus.INFECTED:
            virus = next(c for c in organ.attached if c.type == CardType.VIRUS)
            organ.attached.remove(virus)
            state.discard.append(virus)
            state.discard.append(card)
            events.append(f"P{source.idx} cured P{target_player.idx}'s {organ.color.value} organ")
        else:  # FREE or VACCINATED → attach medicine
            organ.attached.append(card)
            if organ.status == OrganStatus.IMMUNIZED:
                events.append(f"P{source.idx} immunized {'their' if target_player is source else f'P{target_player.idx}'} {organ.color.value} organ")
            else:
                events.append(f"P{source.idx} vaccinated {'their' if target_player is source else f'P{target_player.idx}'} {organ.color.value} organ")
    else:
        raise IllegalAction(f"unexpected attach card type {card.type}")
    return events


# ---- treatments ----------------------------------------------------------

def _legal_treatment_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    kind = card.treatment_kind
    if kind == TreatmentKind.LATEX_GLOVE:
        return [{}]

    if kind == TreatmentKind.ORGAN_THIEF:
        out = []
        thief_colors = _body_colors(state.players[player_idx])
        for p in state.players:
            if p.idx == player_idx:
                continue
            for o in p.body:
                if o.status == OrganStatus.IMMUNIZED:
                    continue
                if o.color != Color.MULTI and o.color in thief_colors:
                    continue
                if o.color == Color.MULTI and Color.MULTI in thief_colors:
                    continue
                if len(state.players[player_idx].body) >= 4:
                    continue
                out.append({"player": p.idx, "organ_id": o.id})
        return out

    if kind == TreatmentKind.MEDICAL_ERROR:
        return [{"player": p.idx} for p in state.players if p.idx != player_idx]

    if kind == TreatmentKind.CONTAGION:
        # Always playable; effect resolves what's possible
        return [{}]

    if kind == TreatmentKind.TRANSPLANT:
        out = []
        players = state.players
        for src in players:
            for dst in players:
                if src.idx == dst.idx:
                    continue
                for o_src in src.body:
                    if o_src.status == OrganStatus.IMMUNIZED:
                        continue
                    for o_dst in dst.body:
                        if o_dst.status == OrganStatus.IMMUNIZED:
                            continue
                        if not _transplant_legal(src, dst, o_src, o_dst):
                            continue
                        out.append({
                            "from": {"player": src.idx, "organ_id": o_src.id},
                            "to":   {"player": dst.idx, "organ_id": o_dst.id},
                        })
        return out

    raise IllegalAction(f"unknown treatment kind {kind}")


def _transplant_legal(src: Player, dst: Player, o_src: Organ, o_dst: Organ) -> bool:
    """A transplant is legal iff after the swap neither body has duplicate colors."""
    src_colors = {o.color for o in src.body if o.id != o_src.id}
    dst_colors = {o.color for o in dst.body if o.id != o_dst.id}
    return o_dst.color not in src_colors and o_src.color not in dst_colors


def _apply_treatment(state: GameState, source: Player, card: Card, targets: dict[str, Any]) -> list[str]:
    kind = card.treatment_kind
    _pop_card_from_hand(source, card.id)

    if kind == TreatmentKind.LATEX_GLOVE:
        for p in state.players:
            if p.idx == source.idx:
                continue
            state.discard.extend(p.hand)
            p.hand.clear()
        state.discard.append(card)
        return [f"P{source.idx} played Latex Glove — all opponents discarded their hands"]

    if kind == TreatmentKind.ORGAN_THIEF:
        target = state.players[targets["player"]]
        organ = _find_organ(target, targets["organ_id"])
        if organ.status == OrganStatus.IMMUNIZED:
            source.hand.append(card)
            raise IllegalAction("cannot steal immunized")
        if len(source.body) >= 4:
            source.hand.append(card)
            raise IllegalAction("body full")
        thief_colors = _body_colors(source)
        if (organ.color != Color.MULTI and organ.color in thief_colors) or (organ.color == Color.MULTI and Color.MULTI in thief_colors):
            source.hand.append(card)
            raise IllegalAction("would create duplicate color")
        target.body.remove(organ)
        source.body.append(organ)
        state.discard.append(card)
        return [f"P{source.idx} stole P{target.idx}'s {organ.color.value} organ"]

    if kind == TreatmentKind.MEDICAL_ERROR:
        target = state.players[targets["player"]]
        source.body, target.body = target.body, source.body
        state.discard.append(card)
        return [f"P{source.idx} swapped bodies with P{target.idx}"]

    if kind == TreatmentKind.TRANSPLANT:
        f, t_ = targets["from"], targets["to"]
        a_player = state.players[f["player"]]
        b_player = state.players[t_["player"]]
        a = _find_organ(a_player, f["organ_id"])
        b = _find_organ(b_player, t_["organ_id"])
        if a.status == OrganStatus.IMMUNIZED or b.status == OrganStatus.IMMUNIZED:
            source.hand.append(card)
            raise IllegalAction("cannot transplant immunized")
        if not _transplant_legal(a_player, b_player, a, b):
            source.hand.append(card)
            raise IllegalAction("transplant would create duplicate color")
        a_idx = a_player.body.index(a)
        b_idx = b_player.body.index(b)
        a_player.body[a_idx] = b
        b_player.body[b_idx] = a
        state.discard.append(card)
        return [f"P{source.idx} swapped P{a_player.idx}'s {a.color.value} with P{b_player.idx}'s {b.color.value}"]

    if kind == TreatmentKind.CONTAGION:
        events: list[str] = []
        # Iterate over source's infected organs; for each, find first free matching-color organ on an opponent
        for src_organ in source.body:
            if src_organ.status != OrganStatus.INFECTED:
                continue
            virus = next(c for c in src_organ.attached if c.type == CardType.VIRUS)
            # find target
            chosen: tuple[Player, Organ] | None = None
            for p in state.players:
                if p.idx == source.idx:
                    continue
                for o in p.body:
                    if o.status != OrganStatus.FREE:
                        continue
                    if not _organ_color_matches(virus.color, o.color):
                        continue
                    chosen = (p, o)
                    break
                if chosen:
                    break
            if chosen:
                tgt_player, tgt_organ = chosen
                src_organ.attached.remove(virus)
                tgt_organ.attached.append(virus)
                events.append(f"P{source.idx} contagion infected P{tgt_player.idx}'s {tgt_organ.color.value} organ")
        state.discard.append(card)
        if not events:
            events.append(f"P{source.idx} played Contagion (no effect)")
        return events

    raise IllegalAction(f"unknown treatment kind {kind}")
