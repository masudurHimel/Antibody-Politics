from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .broadcast import Broadcaster
from .driver import GameDriver
from .game import discard_cards, pass_turn, play_card
from .room import InMemoryRoomStore, Room, RoomStore
from .rules import IllegalAction
from .snapshot import public_snapshot
from .store import GameStore

HUMAN_IDX = 0


def _public_room_view(room: Room) -> dict[str, Any]:
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


def _seat_for(room: Room, token: str) -> int | None:
    for p in room.players:
        if p.token == token:
            return p.seat
    return None


async def _broadcast_lobby(broadcaster: Broadcaster, room: Room) -> None:
    await broadcaster.broadcast_per_seat(
        lambda seat: {"type": "room_state", "my_seat": seat, "room": _public_room_view(room)}
    )


def make_ws_router(
    store_getter,
    room_store_getter=None,
    broadcasters: dict | None = None,
    drivers: dict | None = None,
) -> APIRouter:
    router = APIRouter()

    # ─────────── Solo /ws/games/{id} (backwards compat) ───────────
    @router.websocket("/ws/games/{game_id}")
    async def solo_socket(ws: WebSocket, game_id: str) -> None:
        await ws.accept()
        store: GameStore = store_getter()
        state = store.get(game_id)
        if state is None:
            await ws.send_json({"type": "error", "code": "not_found", "message": "game not found"})
            await ws.close()
            return

        bc = Broadcaster()
        bc.attach(seat=HUMAN_IDX, ws=ws)
        driver = GameDriver(
            room_id=f"solo-{game_id}",
            game_id=game_id,
            game_store=store,
            room_store=InMemoryRoomStore(),
            broadcaster=bc,
            # Solo: no other humans are waiting, so don't auto-discard a
            # random card while the player is still deciding their move.
            human_turn_ms=None,
        )
        driver.start()

        await ws.send_json({"type": "snapshot", "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})

        try:
            while True:
                msg = await ws.receive_json()
                kind = msg.get("type")
                if kind == "pong":
                    continue
                cur = store.get(game_id)
                if cur is None:
                    await ws.send_json({"type": "error", "code": "not_found", "message": "game vanished"})
                    break
                if cur.turn_idx != HUMAN_IDX:
                    await ws.send_json({"type": "error", "code": "not_your_turn", "message": "not your turn"})
                    continue
                try:
                    if kind == "play":
                        events = play_card(cur, HUMAN_IDX, msg["card_id"], msg.get("targets") or {})
                    elif kind == "discard":
                        events = discard_cards(cur, HUMAN_IDX, msg["card_ids"])
                    elif kind == "pass":
                        events = pass_turn(cur, HUMAN_IDX)
                    else:
                        await ws.send_json({"type": "error", "code": "bad_type", "message": f"unknown {kind}"})
                        continue
                except IllegalAction as e:
                    await ws.send_json({"type": "error", "code": "illegal", "message": str(e)})
                    continue
                except KeyError as e:
                    await ws.send_json({"type": "error", "code": "bad_payload", "message": f"missing {e}"})
                    continue

                state_now = cur
                await bc.broadcast_per_seat(
                    lambda viewer, s=state_now, k=kind, ev=events: {
                        "type": "action",
                        "player": HUMAN_IDX,
                        "kind": k,
                        "events": ev,
                        "snapshot": public_snapshot(s, viewer_idx=viewer),
                    }
                )
                driver.on_human_acted()
        except WebSocketDisconnect:
            pass
        finally:
            await driver.cancel()

    # ─────────── Room /ws/rooms/{id}?token=… ───────────
    if room_store_getter is not None and broadcasters is not None and drivers is not None:

        @router.websocket("/ws/rooms/{room_id}")
        async def room_socket(ws: WebSocket, room_id: str, token: str = Query(...)) -> None:
            await ws.accept()
            rooms: RoomStore = room_store_getter()
            room = rooms.get(room_id)
            if room is None:
                await ws.send_json({"type": "error", "code": "no_room", "message": "room not found"})
                await ws.close()
                return
            seat = _seat_for(room, token)
            if seat is None:
                await ws.send_json({"type": "error", "code": "bad_token", "message": "unknown player_token"})
                await ws.close()
                return

            bc: Broadcaster = broadcasters.setdefault(room_id, Broadcaster())
            bc.attach(seat=seat, ws=ws)

            room.players[seat].connected = True
            if room.status == "paused" and seat in room.paused_for:
                room.paused_for.remove(seat)
                if not room.paused_for:
                    room.status = "playing"
                    driver = drivers.get(room_id)
                    if driver:
                        driver.resume()
                    await bc.broadcast("resumed", {})
            rooms.set(room)

            if room.status == "lobby":
                # Only the newly-connected socket gets room_state here.
                # State-change broadcasts (join, ready) happen via room_api.
                await ws.send_json(
                    {"type": "room_state", "my_seat": seat, "room": _public_room_view(room)}
                )
            else:
                state = store_getter().get(room.game_id) if room.game_id else None
                if state is not None:
                    await ws.send_json({
                        "type": "snapshot",
                        "snapshot": public_snapshot(state, viewer_idx=seat),
                    })

            try:
                while True:
                    msg = await ws.receive_json()
                    kind = msg.get("type")
                    if kind == "pong":
                        continue
                    room = rooms.get(room_id)
                    state = store_getter().get(room.game_id) if room and room.game_id else None
                    if state is None or room is None:
                        await ws.send_json({"type": "error", "code": "no_game", "message": "no active game"})
                        continue
                    if state.turn_idx != seat:
                        await ws.send_json({"type": "error", "code": "not_your_turn", "message": "not your turn"})
                        continue
                    try:
                        if kind == "play":
                            events = play_card(state, seat, msg["card_id"], msg.get("targets") or {})
                        elif kind == "discard":
                            events = discard_cards(state, seat, msg["card_ids"])
                        elif kind == "pass":
                            events = pass_turn(state, seat)
                        else:
                            await ws.send_json({"type": "error", "code": "bad_type", "message": f"unknown {kind}"})
                            continue
                    except IllegalAction as e:
                        await ws.send_json({"type": "error", "code": "illegal", "message": str(e)})
                        continue
                    except KeyError as e:
                        await ws.send_json({"type": "error", "code": "bad_payload", "message": f"missing {e}"})
                        continue

                    state_now = state
                    seat_now = seat
                    await bc.broadcast_per_seat(
                        lambda viewer, s=state_now, sn=seat_now, k=kind, ev=events: {
                            "type": "action",
                            "player": sn,
                            "kind": k,
                            "events": ev,
                            "snapshot": public_snapshot(s, viewer_idx=viewer),
                        }
                    )
                    driver = drivers.get(room_id)
                    if driver:
                        driver.on_human_acted()
            except WebSocketDisconnect:
                pass
            finally:
                bc.detach(seat=seat)
                room = rooms.get(room_id)
                if room is not None:
                    room.players[seat].connected = False
                    if room.status == "playing":
                        room.status = "paused"
                        if seat not in room.paused_for:
                            room.paused_for.append(seat)
                        driver = drivers.get(room_id)
                        if driver:
                            driver.pause()
                        await bc.broadcast("paused", {"waiting_for_seats": list(room.paused_for)})
                    rooms.set(room)

    return router
