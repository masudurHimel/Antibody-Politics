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
    # heuristic scoring; a play that helps an opponent or hurts me scores <= 0
    # and is dropped, so the bot discards instead of making it
    scored = [(heuristic_score(state, my_seat, card, tgt), card, tgt) for card, tgt in candidates]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        if _needs_search(scored, state, my_seat):
            best = _mcts_lite(state, my_seat, [(c, t) for _, c, t in scored[:3]])
            if best is not None:
                card, tgt = best
                return ("play", {"card_id": card.id, "targets": tgt})

        _, card, tgt = scored[0]
        return ("play", {"card_id": card.id, "targets": tgt})

    # nothing worth playing → discard worst card
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
            score -= 40.0  # medicating an opponent only helps them
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
            return _transplant_score(state, my_seat, tgt)
        if kind == TreatmentKind.MEDICAL_ERROR:
            target = state.players[tgt["player"]]
            mine_healthy = sum(1 for o in me.body if o.status != OrganStatus.INFECTED)
            theirs_healthy = sum(1 for o in target.body if o.status != OrganStatus.INFECTED)
            return float(theirs_healthy - mine_healthy) * 12.0
    return 0.0


def _transplant_score(state: GameState, my_seat: int, tgt: dict[str, Any]) -> float:
    """Value of a swap for me: my progress gain, or 0 when I'm not part of it."""
    ends = [tgt["from"], tgt["to"]]
    mine = next((e for e in ends if e["player"] == my_seat), None)
    if mine is None:
        return 0.0
    other = ends[1] if mine is ends[0] else ends[0]
    me = state.players[my_seat]
    give = _organ(me, mine["organ_id"])
    take = _organ(state.players[other["player"]], other["organ_id"])
    after = me.model_copy(update={"body": [take if o.id == give.id else o for o in me.body]})
    return float(_progress(after) - _progress(me)) * 30.0


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
    import os
    if os.environ.get("BOT_NO_SEARCH") == "1":
        return None

    budget_s = float(os.environ.get("BOT_BUDGET_S", "1.0"))
    deadline = time.monotonic() + budget_s

    unseen = _unseen_pool(state, my_seat)
    if not unseen:
        return None

    rng = random.Random(state.turn_idx * 1009 + my_seat * 17)

    scores: list[list[float]] = [[] for _ in candidates]
    rollouts_per_cycle = 4
    while time.monotonic() < deadline:
        for i, (card, tgt) in enumerate(candidates):
            for _ in range(rollouts_per_cycle):
                if time.monotonic() >= deadline:
                    break
                outcome = _rollout(state, my_seat, card, tgt, unseen, rng)
                scores[i].append(outcome)

    means = [(sum(s) / len(s) if s else -2.0) for s in scores]
    best_idx = max(range(len(candidates)), key=lambda i: means[i])
    return candidates[best_idx]


def _unseen_pool(state: GameState, my_seat: int) -> list[Card]:
    full = build_deck()
    seen_ids: set[str] = set()
    for p in state.players:
        for c in p.hand:
            seen_ids.add(c.id)
        for o in p.body:
            seen_ids.add(o.id)  # a placed organ keeps its deck card's id
            for c in o.attached:
                seen_ids.add(c.id)
    return [c for c in full if c.id not in seen_ids]


def _rollout(state: GameState, my_seat: int, card: Card, tgt: dict[str, Any],
             unseen: list[Card], rng: random.Random) -> float:
    """Single determinized rollout. +1 self win, -1 any opponent win, 0 timeout/draw."""
    from copy import deepcopy

    sim = deepcopy(state)
    pool = list(unseen)
    rng.shuffle(pool)
    sizes = [3 - len(sim.players[i].hand) if i == my_seat else 3 for i in range(4)]
    # Deal determinized hands to opponents (their hand was empty in the reconstructed state)
    for i in range(4):
        if i == my_seat:
            continue
        for _ in range(3):  # opponents have hand_count=3 by default in reconstructed state
            if pool:
                sim.players[i].hand.append(pool.pop())
    # The deck for the simulation is the remainder
    sim.deck = pool

    # Apply the candidate action
    from .game import discard_cards, play_card
    from .rules import IllegalAction
    try:
        play_card(sim, my_seat, card.id, tgt)
    except IllegalAction:
        return -0.5

    # Continue with heuristic-only policies on all seats
    plies = 0
    max_plies = 60
    while sim.winner_idx is None and plies < max_plies:
        idx = sim.turn_idx
        # pick best heuristic action
        plays = [ct for ct in _enumerate_plays(sim, idx) if heuristic_score(sim, idx, ct[0], ct[1]) > 0]
        if plays:
            best = max(plays, key=lambda ct: heuristic_score(sim, idx, ct[0], ct[1]))
            try:
                play_card(sim, idx, best[0].id, best[1])
            except IllegalAction:
                # fall back to discard
                if sim.players[idx].hand:
                    discard_cards(sim, idx, [sim.players[idx].hand[0].id])
                else:
                    from .game import pass_turn
                    pass_turn(sim, idx)
        elif sim.players[idx].hand:
            discard_cards(sim, idx, [sim.players[idx].hand[0].id])
        else:
            from .game import pass_turn
            pass_turn(sim, idx)
        plies += 1

    if sim.winner_idx is None:
        return 0.0
    return 1.0 if sim.winner_idx == my_seat else -1.0
