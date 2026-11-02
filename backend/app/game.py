from __future__ import annotations

import random
from typing import Any, Optional, Sequence

from .deck import build_deck, draw_one
from .models import GameState, Player
from .rules import IllegalAction, apply_play


def start_game(*, game_id: str, seed: int, names: Sequence[str], bots: Sequence[bool]) -> GameState:
    if len(names) != 4 or len(bots) != 4:
        raise ValueError("Antibody Politics requires exactly 4 seats")

    rng = random.Random(seed)
    deck = build_deck()
    rng.shuffle(deck)

    players = [Player(idx=i, name=names[i], is_bot=bots[i], hand=[], body=[]) for i in range(4)]
    state = GameState(game_id=game_id, seed=seed, players=players, deck=deck, discard=[], turn_idx=0)

    # deal 3 to each, classic round-robin
    for _ in range(3):
        for p in players:
            card = draw_one(state.deck, state.discard)
            assert card is not None
            p.hand.append(card)

    state.event_log.append("Game started")
    return state


def draw_to_three(state: GameState, player_idx: int) -> None:
    while len(state.players[player_idx].hand) < 3:
        card = draw_one(state.deck, state.discard)
        if card is None:
            return
        state.players[player_idx].hand.append(card)


def advance_turn(state: GameState) -> None:
    if state.winner_idx is not None:
        return
    state.turn_idx = (state.turn_idx + 1) % len(state.players)


def check_winner(state: GameState, actor_idx: Optional[int] = None) -> None:
    """Any player can complete their body on someone else's play (Transplant,
    Medical Error). The acting player is checked first, then the rest in seat order."""
    order = sorted(state.players, key=lambda p: (p.idx != actor_idx, p.idx))
    for p in order:
        if p.has_won():
            state.winner_idx = p.idx
            state.event_log.append(f"{p.name} won!")
            return


def play_card(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    events = apply_play(state, player_idx, card_id, targets)
    state.event_log.extend(events)
    check_winner(state, actor_idx=player_idx)
    if state.winner_idx is not None:
        return events
    draw_to_three(state, player_idx)
    advance_turn(state)
    return events


def discard_cards(state: GameState, player_idx: int, card_ids: Sequence[str]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game over")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")
    if not card_ids:
        raise IllegalAction("must discard ≥1 card")
    p = state.players[player_idx]
    by_id = {c.id: c for c in p.hand}
    for cid in card_ids:
        if cid not in by_id:
            raise IllegalAction(f"card {cid} not in hand")
    moved = []
    for cid in card_ids:
        card = by_id[cid]
        p.hand.remove(card)
        state.discard.append(card)
        moved.append(card.id)
    state.event_log.append(f"{p.name} discarded {len(moved)} card{'' if len(moved) == 1 else 's'}")
    draw_to_three(state, player_idx)
    advance_turn(state)
    return [state.event_log[-1]]


def pass_turn(state: GameState, player_idx: int) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game over")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")
    if state.players[player_idx].hand:
        raise IllegalAction("can only pass with empty hand")
    state.event_log.append(f"{state.players[player_idx].name} had no cards and sat the turn out")
    draw_to_three(state, player_idx)
    advance_turn(state)
    return [state.event_log[-1]]
