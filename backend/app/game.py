from __future__ import annotations

import random
from typing import Any, Sequence

from .deck import build_deck, draw_one, shuffle_into
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
            card = draw_one(state.deck, state.discard, rng)
            assert card is not None
            p.hand.append(card)

    state.event_log.append("Game started")
    return state


def draw_to_three(state: GameState, player_idx: int) -> None:
    rng = random.Random(state.seed + state.turn_idx * 31 + player_idx * 7)
    while len(state.players[player_idx].hand) < 3:
        card = draw_one(state.deck, state.discard, rng)
        if card is None:
            return
        state.players[player_idx].hand.append(card)


def advance_turn(state: GameState) -> None:
    if state.winner_idx is not None:
        return
    state.turn_idx = (state.turn_idx + 1) % len(state.players)


def check_winner(state: GameState) -> None:
    for p in state.players:
        if p.has_won():
            state.winner_idx = p.idx
            state.event_log.append(f"P{p.idx} ({p.name}) won!")
            return


def play_card(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    events = apply_play(state, player_idx, card_id, targets)
    state.event_log.extend(events)
    check_winner(state)
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
    state.event_log.append(f"P{player_idx} discarded {len(moved)} card(s)")
    advance_turn(state)
    return [state.event_log[-1]]


def pass_turn(state: GameState, player_idx: int) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game over")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")
    if state.players[player_idx].hand:
        raise IllegalAction("can only pass with empty hand")
    state.event_log.append(f"P{player_idx} passed (empty hand)")
    draw_to_three(state, player_idx)
    advance_turn(state)
    return [state.event_log[-1]]
