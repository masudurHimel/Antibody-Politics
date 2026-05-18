from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .bot import choose_action
from .game import discard_cards, pass_turn, play_card
from .rules import IllegalAction
from .snapshot import public_snapshot
from .store import GameStore


HUMAN_IDX = 0
BOT_FLOOR_MS = 1000  # min perceived think time


def make_ws_router(store_getter) -> APIRouter:
    router = APIRouter()

    @router.websocket("/ws/games/{game_id}")
    async def game_socket(ws: WebSocket, game_id: str) -> None:
        await ws.accept()
        store: GameStore = store_getter()
        state = store.get(game_id)
        if state is None:
            await ws.send_json({"type": "error", "code": "not_found", "message": "game not found"})
            await ws.close()
            return

        # initial snapshot
        await ws.send_json({"type": "snapshot", "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})

        # if bot's turn at connect, drive bot turns
        await _drive_bots(ws, store, game_id)

        try:
            while True:
                msg = await ws.receive_json()
                kind = msg.get("type")
                state = store.get(game_id)
                if state is None:
                    await ws.send_json({"type": "error", "code": "not_found", "message": "game vanished"})
                    return
                if state.turn_idx != HUMAN_IDX:
                    await ws.send_json({"type": "error", "code": "not_your_turn", "message": "not your turn"})
                    continue

                try:
                    if kind == "play":
                        events = play_card(state, HUMAN_IDX, msg["card_id"], msg.get("targets") or {})
                        await _emit_action(ws, state, HUMAN_IDX, "play", events)
                    elif kind == "discard":
                        events = discard_cards(state, HUMAN_IDX, msg["card_ids"])
                        await _emit_action(ws, state, HUMAN_IDX, "discard", events)
                    elif kind == "pass":
                        events = pass_turn(state, HUMAN_IDX)
                        await _emit_action(ws, state, HUMAN_IDX, "pass", events)
                    else:
                        await ws.send_json({"type": "error", "code": "bad_type", "message": f"unknown {kind}"})
                        continue
                except IllegalAction as e:
                    await ws.send_json({"type": "error", "code": "illegal", "message": str(e)})
                    continue
                except KeyError as e:
                    await ws.send_json({"type": "error", "code": "bad_payload", "message": f"missing {e}"})
                    continue

                if state.winner_idx is not None:
                    await ws.send_json({"type": "game_over", "winner_idx": state.winner_idx,
                                        "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})
                    continue

                await _drive_bots(ws, store, game_id)
        except WebSocketDisconnect:
            return


    return router


async def _drive_bots(ws: WebSocket, store: GameStore, game_id: str) -> None:
    while True:
        state = store.get(game_id)
        if state is None or state.winner_idx is not None:
            return
        if state.turn_idx == HUMAN_IDX:
            return

        idx = state.turn_idx
        await ws.send_json({"type": "bot_thinking", "player": idx, "expected_ms": 1500})

        started = time.monotonic()
        snap = public_snapshot(state, viewer_idx=idx)
        kind, payload = await asyncio.to_thread(choose_action, snap, idx)

        try:
            if kind == "play":
                events = play_card(state, idx, payload["card_id"], payload["targets"])
            elif kind == "discard":
                events = discard_cards(state, idx, payload["card_ids"])
            else:
                events = pass_turn(state, idx)
        except IllegalAction as e:
            # bot tried something illegal — fall back to discard one card if possible, else pass
            if state.players[idx].hand:
                events = discard_cards(state, idx, [state.players[idx].hand[0].id])
                kind = "discard"
            else:
                events = pass_turn(state, idx)
                kind = "pass"

        elapsed_ms = (time.monotonic() - started) * 1000
        if elapsed_ms < BOT_FLOOR_MS:
            await asyncio.sleep((BOT_FLOOR_MS - elapsed_ms) / 1000.0)

        await _emit_action(ws, state, idx, kind, events)

        if state.winner_idx is not None:
            await ws.send_json({"type": "game_over", "winner_idx": state.winner_idx,
                                "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})
            return


async def _emit_action(ws: WebSocket, state, player: int, kind: str, events: list[str]) -> None:
    await ws.send_json({
        "type": "action",
        "player": player,
        "kind": kind,
        "events": events,
        "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX),
    })
