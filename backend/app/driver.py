from __future__ import annotations

import asyncio
import random
import time
from typing import Optional

from .bot import choose_action
from .broadcast import Broadcaster
from .game import discard_cards, pass_turn, play_card
from .models import GameState
from .room import RoomStore
from .rules import IllegalAction
from .snapshot import public_snapshot
from .store import GameStore

HUMAN_TURN_MS = 10_000
BOT_FLOOR_MS = 1_000


class GameDriver:
    def __init__(
        self,
        *,
        room_id: str,
        game_id: str,
        game_store: GameStore,
        room_store: RoomStore,
        broadcaster: Broadcaster,
        floor_ms: int = BOT_FLOOR_MS,
    ) -> None:
        self.room_id = room_id
        self.game_id = game_id
        self.game_store = game_store
        self.room_store = room_store
        self.broadcaster = broadcaster
        self.floor_ms = floor_ms

        self._wake = asyncio.Event()
        self._pause = asyncio.Event()
        self._pause.set()
        self._turn_remaining_ms: Optional[int] = None
        self._current_wait: Optional[asyncio.Task] = None
        self._task: Optional[asyncio.Task] = None

    def start(self) -> asyncio.Task:
        self._task = asyncio.create_task(self.run())
        return self._task

    async def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass

    def on_human_acted(self) -> None:
        self._wake.set()

    def pause(self) -> None:
        self._pause.clear()
        self._cancel_current_wait()

    def resume(self) -> None:
        self._pause.set()

    async def run(self) -> None:
        while True:
            await self._pause.wait()
            state = self.game_store.get(self.game_id)
            if state is None or state.winner_idx is not None:
                if state is not None and state.winner_idx is not None:
                    await self._broadcast_game_over(state)
                return

            seat = state.turn_idx
            player = state.players[seat]
            if player.is_bot:
                await self._run_bot_turn(state, seat)
            else:
                await self._run_human_turn(state, seat)

    async def _run_bot_turn(self, state: GameState, seat: int) -> None:
        await self.broadcaster.broadcast(
            "bot_thinking", {"player": seat, "expected_ms": 1500}
        )
        started = time.monotonic()
        snap = public_snapshot(state, viewer_idx=seat)
        kind, payload = await asyncio.to_thread(choose_action, snap, seat)
        try:
            events = self._apply_move(state, seat, kind, payload)
        except IllegalAction:
            kind, events = self._fallback(state, seat)

        elapsed_ms = (time.monotonic() - started) * 1000
        if elapsed_ms < self.floor_ms:
            await asyncio.sleep((self.floor_ms - elapsed_ms) / 1000.0)

        await self._broadcast_action(state, seat, kind, events)

    async def _run_human_turn(self, state: GameState, seat: int) -> None:
        budget_ms = self._turn_remaining_ms or HUMAN_TURN_MS
        deadline_ms = int(time.time() * 1000) + budget_ms
        await self.broadcaster.broadcast(
            "human_thinking", {"player": seat, "deadline_ms": deadline_ms}
        )

        self._wake.clear()
        started = time.monotonic()
        self._current_wait = asyncio.create_task(self._wake.wait())
        try:
            await asyncio.wait_for(
                asyncio.shield(self._current_wait), timeout=budget_ms / 1000
            )
            self._turn_remaining_ms = None
            return
        except asyncio.TimeoutError:
            self._turn_remaining_ms = None
            kind, events = self._auto_discard(state, seat)
            await self._broadcast_action(state, seat, kind, events)
        except asyncio.CancelledError:
            elapsed_ms = (time.monotonic() - started) * 1000
            if not self._pause.is_set():
                self._turn_remaining_ms = max(0, budget_ms - int(elapsed_ms))
            else:
                self._turn_remaining_ms = None
            return
        finally:
            if self._current_wait and not self._current_wait.done():
                self._current_wait.cancel()
            self._current_wait = None

    def _cancel_current_wait(self) -> None:
        """Used by `pause()` to interrupt an in-flight human turn."""
        if self._current_wait and not self._current_wait.done():
            self._current_wait.cancel()

    def _apply_move(self, state: GameState, seat: int, kind: str, payload: dict) -> list[str]:
        if kind == "play":
            return play_card(state, seat, payload["card_id"], payload.get("targets", {}))
        if kind == "discard":
            return discard_cards(state, seat, payload["card_ids"])
        return pass_turn(state, seat)

    def _fallback(self, state: GameState, seat: int) -> tuple[str, list[str]]:
        hand = state.players[seat].hand
        if hand:
            return "discard", discard_cards(state, seat, [hand[0].id])
        return "pass", pass_turn(state, seat)

    def _auto_discard(self, state: GameState, seat: int) -> tuple[str, list[str]]:
        hand = state.players[seat].hand
        if not hand:
            return "pass", pass_turn(state, seat)
        rng = random.Random(state.seed + state.turn_idx * 101 + len(state.event_log))
        chosen = rng.choice(hand)
        events = discard_cards(state, seat, [chosen.id])
        return "discard", [f"P{seat} timed out — auto-discarded"] + events

    async def _broadcast_action(
        self, state: GameState, seat: int, kind: str, events: list[str]
    ) -> None:
        def build(viewer: int) -> dict:
            return {
                "type": "action",
                "player": seat,
                "kind": kind,
                "events": events,
                "snapshot": public_snapshot(state, viewer_idx=viewer),
            }
        await self.broadcaster.broadcast_per_seat(build)
        if state.winner_idx is not None:
            await self._broadcast_game_over(state)

    async def _broadcast_game_over(self, state: GameState) -> None:
        def build(viewer: int) -> dict:
            return {
                "type": "game_over",
                "winner_idx": state.winner_idx,
                "snapshot": public_snapshot(state, viewer_idx=viewer),
            }
        await self.broadcaster.broadcast_per_seat(build)
