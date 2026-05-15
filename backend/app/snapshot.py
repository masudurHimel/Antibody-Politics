from __future__ import annotations

from typing import Any

from .models import GameState


def public_snapshot(state: GameState, viewer_idx: int) -> dict[str, Any]:
    players = []
    for p in state.players:
        body = [o.model_dump(mode="json") for o in p.body]
        if p.idx == viewer_idx:
            hand: Any = [c.model_dump(mode="json") for c in p.hand]
        else:
            hand = None
        players.append({
            "idx": p.idx,
            "name": p.name,
            "is_bot": p.is_bot,
            "hand": hand,
            "hand_count": len(p.hand),
            "body": body,
        })

    return {
        "game_id": state.game_id,
        "viewer_idx": viewer_idx,
        "turn_idx": state.turn_idx,
        "winner_idx": state.winner_idx,
        "deck_count": len(state.deck),
        "discard_count": len(state.discard),
        "discard_top": state.discard[-1].model_dump(mode="json") if state.discard else None,
        "event_log": list(state.event_log[-50:]),
        "players": players,
    }
