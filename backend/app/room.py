from __future__ import annotations

import secrets
import time
from typing import Iterator, Literal, Optional, Protocol

from pydantic import BaseModel, Field

RoomStatus = Literal["lobby", "playing", "paused", "ended"]


class RoomPlayer(BaseModel):
    token: str
    seat: int
    name: str
    is_host: bool
    is_bot: bool = False
    ready: bool = False
    connected: bool = False


class Room(BaseModel):
    id: str
    status: RoomStatus
    players: list[RoomPlayer] = Field(default_factory=list)
    game_id: Optional[str] = None
    paused_for: list[int] = Field(default_factory=list)
    created_at: float


class RoomStore(Protocol):
    def get(self, room_id: str) -> Optional[Room]: ...
    def set(self, room: Room) -> None: ...
    def delete(self, room_id: str) -> None: ...
    def iter_rooms(self) -> Iterator[Room]: ...


class InMemoryRoomStore:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def get(self, room_id: str) -> Optional[Room]:
        return self._rooms.get(room_id)

    def set(self, room: Room) -> None:
        self._rooms[room.id] = room

    def delete(self, room_id: str) -> None:
        self._rooms.pop(room_id, None)

    def iter_rooms(self) -> Iterator[Room]:
        return iter(self._rooms.values())


# 4-char alphabet, no 0/O/1/I
ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
NAME_MAX = 20


class InvalidName(ValueError):
    pass


class RoomError(ValueError):
    """Domain error for room operations; HTTP layer maps to 4xx."""
    code: str = "room_error"


class RoomFull(RoomError):
    code = "room_full"


class RoomNotJoinable(RoomError):
    code = "not_joinable"


class NotHost(RoomError):
    code = "not_host"


class NotAllReady(RoomError):
    code = "not_all_ready"


class BadState(RoomError):
    code = "bad_state"


def normalize_name(raw: str) -> str:
    s = raw.strip()
    if not s:
        raise InvalidName("name is required")
    return s[:NAME_MAX]


def generate_room_id(store: RoomStore) -> str:
    for _ in range(64):
        candidate = "".join(secrets.choice(ROOM_ID_ALPHABET) for _ in range(4))
        if store.get(candidate) is None:
            return candidate
    raise RuntimeError("could not allocate room id; too many active rooms")


def _new_token() -> str:
    return secrets.token_hex(16)


def create_room(store: RoomStore, *, host_name: str) -> tuple[Room, str]:
    name = normalize_name(host_name)
    rid = generate_room_id(store)
    token = _new_token()
    host = RoomPlayer(token=token, seat=0, name=name, is_host=True)
    room = Room(id=rid, status="lobby", players=[host], created_at=time.time())
    store.set(room)
    return room, token


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import GameState

BOT_NAMES = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta"]


def _by_token(room: Room, token: str) -> RoomPlayer:
    for p in room.players:
        if p.token == token:
            return p
    raise BadState("unknown player_token")


def join_room(store: RoomStore, room_id: str, *, name: str) -> tuple[Room, str]:
    room = store.get(room_id)
    if room is None:
        raise BadState("room not found")
    if room.status != "lobby":
        raise RoomNotJoinable("game already started")
    if len(room.players) >= 4:
        raise RoomFull("room is full")
    nm = normalize_name(name)
    seat = len(room.players)
    token = _new_token()
    room.players.append(RoomPlayer(token=token, seat=seat, name=nm, is_host=False))
    store.set(room)
    return room, token


def set_ready(store: RoomStore, room_id: str, token: str, *, ready: bool) -> Room:
    room = store.get(room_id)
    if room is None:
        raise BadState("room not found")
    p = _by_token(room, token)
    p.ready = ready
    store.set(room)
    return room


def start_room(
    store: RoomStore, room_id: str, token: str, *, game_seed: int
) -> tuple[Room, "GameState"]:
    from .game import start_game

    room = store.get(room_id)
    if room is None:
        raise BadState("room not found")
    if room.status != "lobby":
        raise BadState("not in lobby")
    host = _by_token(room, token)
    if not host.is_host:
        raise NotHost("only host can start")
    if not all(p.ready for p in room.players):
        raise NotAllReady("all humans must be ready")

    bot_idx = 0
    while len(room.players) < 4:
        seat = len(room.players)
        room.players.append(
            RoomPlayer(
                token=_new_token(),
                seat=seat,
                name=BOT_NAMES[bot_idx],
                is_host=False,
                is_bot=True,
                ready=True,
                connected=True,
            )
        )
        bot_idx += 1

    names = [p.name for p in room.players]
    bots = [p.is_bot for p in room.players]
    game_id = f"g{room.id}{secrets.token_hex(2)}"
    state = start_game(game_id=game_id, seed=game_seed, names=names, bots=bots)
    room.status = "playing"
    room.game_id = game_id
    store.set(room)
    return room, state


def terminate_room(store: RoomStore, room_id: str, token: str) -> Room:
    room = store.get(room_id)
    if room is None:
        raise BadState("room not found")
    host = _by_token(room, token)
    if not host.is_host:
        raise NotHost("only host can terminate")
    if room.status != "paused":
        raise BadState("can only terminate a paused game")
    room.status = "ended"
    store.set(room)
    return room
