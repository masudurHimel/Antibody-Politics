from __future__ import annotations

import random
import time
from typing import Any, Optional

from .deck import build_deck
from .models import Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind
from .rules import IllegalAction, legal_targets


# ---------- public ----------

def choose_action(snapshot: dict[str, Any], my_seat: int) -> tuple[str, dict[str, Any]]:
    _assert_fair_snapshot(snapshot, my_seat)

    state = _state_from_snapshot(snapshot, my_seat)
    me = state.players[my_seat]
    if not me.hand:
        return ("pass", {})

    candidates = _enumerate_plays(state, my_seat)
    if candidates:
        # heuristic scoring
        scored = [(heuristic_score(state, my_seat, card, tgt), card, tgt) for card, tgt in candidates]
        scored.sort(key=lambda x: x[0], reverse=True)

        if _needs_search(scored, state, my_seat):
            best = _mcts_lite(state, my_seat, [(c, t) for _, c, t in scored[:3]])
            if best is not None:
                card, tgt = best
                return ("play", {"card_id": card.id, "targets": tgt})

        _, card, tgt = scored[0]
        return ("play", {"card_id": card.id, "targets": tgt})

    # nothing legal to play → discard worst card
    worst = _worst_discard(state, my_seat)
    return ("discard", {"card_ids": [worst.id]})


# ---------- snapshot reconstruction ----------

def _assert_fair_snapshot(snapshot: dict[str, Any], my_seat: int) -> None:
    for p in snapshot["players"]:
        if p["idx"] != my_seat and p["hand"] is not None:
            raise ValueError(f"snapshot leaks hand of P{p['idx']}")
    if snapshot["players"][my_seat]["hand"] is None:
        raise ValueError("own hand is hidden in snapshot")


def _state_from_snapshot(snapshot: dict[str, Any], my_seat: int) -> GameState:
    """Reconstruct a partial GameState the rules engine can work with.
    Opponent hands are unknown — represented as empty for legality checks
    (this is fine because bots only need to evaluate their own actions)."""
    from .models import GameState, Player, Organ, Card as M
    players = []
    for p in snapshot["players"]:
        hand_models = [M(**c) for c in (p["hand"] or [])]
        body_models = [Organ(id=o["id"], color=o["color"], attached=[M(**a) for a in o["attached"]]) for o in p["body"]]
        players.append(Player(idx=p["idx"], name=p["name"], is_bot=p["is_bot"], hand=hand_models, body=body_models))

    return GameState(
        game_id=snapshot["game_id"],
        seed=0,
        players=players,
        deck=[],
        discard=[],
        turn_idx=snapshot["turn_idx"],
        winner_idx=snapshot.get("winner_idx"),
        event_log=list(snapshot.get("event_log", [])),
    )


def _enumerate_plays(state: GameState, my_seat: int) -> list[tuple[Card, dict[str, Any]]]:
    out: list[tuple[Card, dict[str, Any]]] = []
    for card in state.players[my_seat].hand:
        try:
            tgts = legal_targets(state, my_seat, card)
        except IllegalAction:
            continue
        for t in tgts:
            out.append((card, t))
    return out


# ---------- heuristic ----------

def heuristic_score(state: GameState, my_seat: int, card: Card, tgt: dict[str, Any]) -> float:
    me = state.players[my_seat]
    score = 0.0

    if card.type == CardType.ORGAN:
        score += 30.0
        # Slight preference for a color you don't have yet
        if card.color not in {o.color for o in me.body}:
            score += 5.0
        return score

    if card.type == CardType.MEDICINE:
        target_player = state.players[tgt["player"]]
        organ = _organ(target_player, tgt["organ_id"])
        if target_player.idx == my_seat:
            if organ.status == OrganStatus.INFECTED:
                score += 35.0   # cure
            elif organ.status == OrganStatus.VACCINATED:
                score += 40.0   # → immunize, permanent
            else:
                score += 18.0   # vaccinate
            score += _color_priority_bonus(me, organ.color)
        else:
            score += 2.0  # rarely useful to medicate opponents
        return score

    if card.type == CardType.VIRUS:
        target_player = state.players[tgt["player"]]
        if target_player.idx == my_seat:
            return -50.0
        organ = _organ(target_player, tgt["organ_id"])
        # prefer to hit leader
        leader_bonus = 8.0 if _is_leader(target_player, state, my_seat) else 0.0
        if organ.status == OrganStatus.INFECTED:
            score += 35.0 + leader_bonus   # destroy
        elif organ.status == OrganStatus.VACCINATED:
            score += 25.0 + leader_bonus   # strip vaccine
        else:
            score += 18.0 + leader_bonus   # infect
        return score

    if card.type == CardType.TREATMENT:
        kind = card.treatment_kind
        if kind == TreatmentKind.LATEX_GLOVE:
            return 22.0
        if kind == TreatmentKind.CONTAGION:
            infected = sum(1 for o in me.body if o.status == OrganStatus.INFECTED)
            return 12.0 * infected
        if kind == TreatmentKind.ORGAN_THIEF:
            target = state.players[tgt["player"]]
            organ = _organ(target, tgt["organ_id"])
            score = 28.0
            if _is_leader(target, state, my_seat):
                score += 10.0
            score += _color_priority_bonus(me, organ.color)
            return score
        if kind == TreatmentKind.TRANSPLANT:
            return 18.0
        if kind == TreatmentKind.MEDICAL_ERROR:
            target = state.players[tgt["player"]]
            mine_healthy = sum(1 for o in me.body if o.status != OrganStatus.INFECTED)
            theirs_healthy = sum(1 for o in target.body if o.status != OrganStatus.INFECTED)
            return float(theirs_healthy - mine_healthy) * 12.0
    return 0.0


def _color_priority_bonus(me: Player, color: Color) -> float:
    """Bonus when this color completes a distinct-color set."""
    healthy = [o for o in me.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
    cset = {o.color for o in healthy}
    if color == Color.MULTI:
        return 6.0
    return 8.0 if color not in cset else 0.0


def _is_leader(target: Player, state: GameState, my_seat: int) -> bool:
    counts = [_progress(p) for p in state.players]
    return _progress(target) == max(counts) and target.idx != my_seat


def _progress(p: Player) -> int:
    healthy = [o for o in p.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
    return len({o.color for o in healthy})


def _organ(p: Player, organ_id: str) -> Organ:
    return next(o for o in p.body if o.id == organ_id)


def _worst_discard(state: GameState, my_seat: int) -> Card:
    me = state.players[my_seat]
    # discard the card whose best-target heuristic is lowest
    by_card: list[tuple[float, Card]] = []
    for c in me.hand:
        try:
            tgts = legal_targets(state, my_seat, c)
        except IllegalAction:
            tgts = []
        best = max((heuristic_score(state, my_seat, c, t) for t in tgts), default=0.0)
        by_card.append((best, c))
    by_card.sort(key=lambda x: x[0])
    return by_card[0][1]


# ---------- MCTS-lite stub (to be implemented in Task 2.2) ----------

def _needs_search(scored: list, state: GameState, my_seat: int) -> bool:
    if len(scored) < 2:
        return False
    top, second = scored[0][0], scored[1][0]
    if top - second < 0.1 * max(1.0, top):
        return True
    # any player one organ from winning?
    for p in state.players:
        if _progress(p) >= 3:
            return True
    return False


def _mcts_lite(state: GameState, my_seat: int, candidates: list[tuple[Card, dict[str, Any]]]) -> Optional[tuple[Card, dict[str, Any]]]:
    # Stubbed until Task 2.2 — return None to fall back to heuristic.
    return None
