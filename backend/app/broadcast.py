from __future__ import annotations

import asyncio
from typing import Any, Callable, Protocol


class _SocketLike(Protocol):
    async def send_json(self, payload: dict[str, Any]) -> None: ...


class Broadcaster:
    """Tracks one WebSocket per seat in a room. Sends per-seat or shared payloads."""

    def __init__(self) -> None:
        self._sockets: dict[int, _SocketLike] = {}
        self._lock = asyncio.Lock()

    def attach(self, *, seat: int, ws: _SocketLike) -> None:
        self._sockets[seat] = ws

    def detach(self, *, seat: int) -> None:
        self._sockets.pop(seat, None)

    def connected_seats(self) -> set[int]:
        return set(self._sockets.keys())

    async def broadcast(self, kind: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            dead: list[int] = []
            for seat, ws in list(self._sockets.items()):
                try:
                    await ws.send_json({"type": kind, **payload})
                except Exception:
                    dead.append(seat)
            for seat in dead:
                self._sockets.pop(seat, None)

    async def broadcast_per_seat(
        self, build: Callable[[int], dict[str, Any]]
    ) -> None:
        async with self._lock:
            dead: list[int] = []
            for seat, ws in list(self._sockets.items()):
                try:
                    await ws.send_json(build(seat))
                except Exception:
                    dead.append(seat)
            for seat in dead:
                self._sockets.pop(seat, None)
