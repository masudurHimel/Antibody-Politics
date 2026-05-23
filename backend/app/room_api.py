from __future__ import annotations

import random
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .room import (
    BadState,
    InvalidName,
    NotAllReady,
    NotHost,
    Room,
    RoomError,
    RoomFull,
    RoomNotJoinable,
    RoomStore,
    create_room,
    join_room,
    set_ready,
    start_room,
    terminate_room,
)


class CreateRoomBody(BaseModel):
    host_name: str


class JoinBody(BaseModel):
    name: str


class ReadyBody(BaseModel):
    player_token: str
    ready: bool


class TokenBody(BaseModel):
    player_token: str


def _public_view(room: Room) -> dict[str, Any]:
    return {
        "id": room.id,
        "status": room.status,
        "game_id": room.game_id,
        "players": [
            {
                "seat": p.seat,
                "name": p.name,
                "is_host": p.is_host,
                "is_bot": p.is_bot,
                "ready": p.ready,
                "connected": p.connected,
            }
            for p in room.players
        ],
        "paused_for": list(room.paused_for),
    }


def _http(exc: RoomError) -> HTTPException:
    code_to_status = {
        "room_full": 409,
        "not_joinable": 409,
        "not_host": 403,
        "not_all_ready": 400,
        "bad_state": 400,
    }
    return HTTPException(code_to_status.get(exc.code, 400), str(exc))


def make_room_router(
    room_store_getter,
    game_store_getter,
    start_driver,
    broadcast_room_state=None,   # async (room_id, public_view) | None
    broadcast_terminated=None,   # async (room_id) | None
) -> APIRouter:
    router = APIRouter(prefix="/api/rooms")

    async def _notify(room: Room) -> None:
        if broadcast_room_state is not None:
            await broadcast_room_state(room.id, _public_view(room))

    @router.post("")
    async def create(body: CreateRoomBody) -> dict[str, Any]:
        try:
            room, token = create_room(room_store_getter(), host_name=body.host_name)
        except InvalidName as e:
            raise HTTPException(400, str(e))
        return {
            "room_id": room.id,
            "player_token": token,
            "seat": 0,
            "ws_url": f"/ws/rooms/{room.id}",
        }

    @router.get("/{room_id}")
    async def get(room_id: str) -> dict[str, Any]:
        room = room_store_getter().get(room_id)
        if room is None:
            raise HTTPException(404, "room not found")
        return _public_view(room)

    @router.post("/{room_id}/join")
    async def join(room_id: str, body: JoinBody) -> dict[str, Any]:
        try:
            room, token = join_room(room_store_getter(), room_id, name=body.name)
        except InvalidName as e:
            raise HTTPException(400, str(e))
        except RoomError as e:
            raise _http(e)
        await _notify(room)
        return {
            "player_token": token,
            "seat": room.players[-1].seat,
            "ws_url": f"/ws/rooms/{room.id}",
        }

    @router.post("/{room_id}/ready")
    async def ready(room_id: str, body: ReadyBody) -> dict[str, Any]:
        try:
            room = set_ready(room_store_getter(), room_id, body.player_token, ready=body.ready)
        except RoomError as e:
            raise _http(e)
        await _notify(room)
        return {"ok": True}

    @router.post("/{room_id}/start")
    async def start(room_id: str, body: TokenBody) -> dict[str, Any]:
        try:
            room, state = start_room(
                room_store_getter(),
                room_id,
                body.player_token,
                game_seed=random.randint(0, 2**31 - 1),
            )
        except RoomError as e:
            raise _http(e)
        game_store_getter().set(state)
        await _notify(room)  # tells lobby clients status=playing so they switch screens
        start_driver(room.id, state.game_id)
        return {"game_id": state.game_id}

    @router.post("/{room_id}/terminate")
    async def terminate(room_id: str, body: TokenBody) -> dict[str, Any]:
        try:
            room = terminate_room(room_store_getter(), room_id, body.player_token)
        except RoomError as e:
            raise _http(e)
        # Cancel the driver and broadcast a terminated event.
        if broadcast_terminated is not None:
            await broadcast_terminated(room.id)
        return {"ok": True}

    return router
