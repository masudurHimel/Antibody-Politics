# Multiplayer Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a room-based multiplayer mode (1–4 humans + bot fill, host-controlled, share via ngrok URL) without changing the existing engine (`rules.py`, `game.py`, `snapshot.py`, `bot.py`).

**Architecture:** A new `room.py` module owns lobby state; a new `driver.py` owns the per-game turn loop (bot moves, 10s human timer, pause/resume); a new `/ws/rooms/{id}?token=…` socket per player handles transport with per-viewer snapshot fan-out. The existing `/api/games` solo flow is migrated to wrap `GameDriver` with one human at seat 0; the rest of the engine is untouched.

**Tech Stack:** FastAPI + Pydantic (backend), pytest (`backend/venv/bin/pytest`), React + Zustand + Framer Motion + Vite (frontend), Vitest (frontend tests), ngrok (tunneling).

**Source spec:** `docs/superpowers/specs/2026-05-21-multiplayer-design.md`

---

## File Structure

**New backend files**
- `backend/app/room.py` — `Room`, `RoomPlayer`, `RoomStore`, `InMemoryRoomStore`, lobby state transitions, room-id generation, name validation.
- `backend/app/room_api.py` — FastAPI router for the REST surface (`POST /api/rooms`, `/join`, `/ready`, `/start`, `/terminate`, `GET /api/rooms/{id}`).
- `backend/app/driver.py` — `GameDriver` asyncio task: bot turns, 10s human timer, pause/resume, deterministic auto-discard.
- `backend/app/broadcast.py` — `Broadcaster` per room: track sockets, send per-viewer snapshots, ping heartbeat.
- `backend/tests/test_room.py`
- `backend/tests/test_driver.py`
- `backend/tests/test_ws_multiplayer.py`

**New frontend files**
- `frontend/src/pages/MultiplayerLanding.tsx`
- `frontend/src/pages/JoinRoom.tsx`
- `frontend/src/pages/Lobby.tsx`
- `frontend/src/components/TurnTimer.tsx`
- `frontend/src/components/PauseOverlay.tsx`
- `frontend/src/game/room.ts` — REST helpers (`createRoom`, `joinRoom`, `getRoom`, `setReady`, `startRoom`, `terminateRoom`) + types (`Room`, `RoomPlayer`).
- `frontend/src/game/__tests__/store.test.ts` — Vitest for the new room/driver event handlers in the store.

**New infra**
- `scripts/tunnel.sh`

**Modified backend files**
- `backend/app/main.py` — register room router; instantiate `RoomStore` + `Broadcaster` registry; lifespan cancels driver tasks on shutdown.
- `backend/app/ws.py` — rewrite. Replace inline `_drive_bots` with a thin handler that delegates to `GameDriver`. Add new `/ws/rooms/{id}?token=…` route. Keep `/ws/games/{id}` working via a "single-player room" adapter so the existing DEAL flow is unchanged for users.

**Modified frontend files**
- `frontend/src/App.tsx` — path-based first-load route, plus screen state machine `mp_landing | join | lobby | game | solo`.
- `frontend/src/pages/NewGame.tsx` — add MULTIPLAYER secondary CTA.
- `frontend/src/pages/Game.tsx` — embed `TurnTimer` + `PauseOverlay`.
- `frontend/src/game/store.ts` — add `room`, `mySeat`, `playerToken`, `turnDeadline`, `isPaused`; new server-event cases.
- `frontend/src/game/types.ts` — add new server event union cases.
- `frontend/src/game/ws.ts` — add `connectRoomWs(roomId, token)`; pong/ping handlers.
- `README.md` — short ngrok paragraph.

---

## Task 1: Room and RoomPlayer models + RoomStore protocol

**Files:**
- Create: `backend/app/room.py`
- Create: `backend/tests/test_room.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_room.py
from app.room import Room, RoomPlayer, InMemoryRoomStore


def test_room_player_defaults():
    p = RoomPlayer(token="abc", seat=0, name="Alice", is_host=True)
    assert p.ready is False
    assert p.is_bot is False
    assert p.connected is False


def test_in_memory_store_round_trip():
    store = InMemoryRoomStore()
    room = Room(
        id="AB12",
        status="lobby",
        players=[RoomPlayer(token="t1", seat=0, name="Alice", is_host=True)],
        created_at=0.0,
    )
    store.set(room)
    fetched = store.get("AB12")
    assert fetched is not None
    assert fetched.players[0].name == "Alice"
    store.delete("AB12")
    assert store.get("AB12") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: ImportError (`app.room` does not exist).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/room.py
from __future__ import annotations

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/room.py backend/tests/test_room.py
git commit -m "feat(room): Room/RoomPlayer models + InMemoryRoomStore"
```

---

## Task 2: Room creation, id generation, name validation

**Files:**
- Modify: `backend/app/room.py`
- Modify: `backend/tests/test_room.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_room.py`:

```python
import pytest

from app.room import (
    ROOM_ID_ALPHABET,
    InvalidName,
    create_room,
    generate_room_id,
    normalize_name,
)


def test_normalize_name_strips_and_caps():
    assert normalize_name("  Bob  ") == "Bob"
    assert normalize_name("X" * 30) == "X" * 20


def test_normalize_name_rejects_empty():
    with pytest.raises(InvalidName):
        normalize_name("   ")


def test_room_id_uses_safe_alphabet():
    rid = generate_room_id()
    assert len(rid) == 4
    assert all(c in ROOM_ID_ALPHABET for c in rid)


def test_create_room_assigns_host_seat_zero():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    assert len(room.players) == 1
    assert room.players[0].seat == 0
    assert room.players[0].is_host is True
    assert room.players[0].name == "Alice"
    assert room.players[0].token == host_token
    assert room.status == "lobby"
    # Stored
    assert store.get(room.id) is room


def test_create_room_avoids_id_collision():
    store = InMemoryRoomStore()
    first, _ = create_room(store, host_name="Alice")
    # Force collisions by seeding RNG predictably is overkill — just create 50 rooms
    seen = {first.id}
    for i in range(50):
        r, _ = create_room(store, host_name=f"P{i}")
        assert r.id not in seen
        seen.add(r.id)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: ImportError for `create_room`, `generate_room_id`, `normalize_name`, `InvalidName`, `ROOM_ID_ALPHABET`.

- [ ] **Step 3: Implement**

Append to `backend/app/room.py`:

```python
import secrets
import time

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/room.py backend/tests/test_room.py
git commit -m "feat(room): create_room, id generation, name validation"
```

---

## Task 3: Join room, ready toggle, host-only start

**Files:**
- Modify: `backend/app/room.py`
- Modify: `backend/tests/test_room.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_room.py`:

```python
from app.room import join_room, set_ready, start_room, terminate_room


def test_join_room_fills_next_seat():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="Alice")
    room2, bob_token = join_room(store, room.id, name="Bob")
    assert room2.players[1].seat == 1
    assert room2.players[1].name == "Bob"
    assert room2.players[1].token == bob_token
    assert room2.players[1].is_host is False


def test_join_room_caps_at_four():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="A")
    join_room(store, room.id, name="B")
    join_room(store, room.id, name="C")
    join_room(store, room.id, name="D")
    with pytest.raises(RoomFull):
        join_room(store, room.id, name="E")


def test_join_room_rejects_non_lobby():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="A")
    room.status = "playing"
    store.set(room)
    with pytest.raises(RoomNotJoinable):
        join_room(store, room.id, name="B")


def test_set_ready_toggle():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    set_ready(store, room.id, host_token, ready=True)
    assert store.get(room.id).players[0].ready is True
    set_ready(store, room.id, host_token, ready=False)
    assert store.get(room.id).players[0].ready is False


def test_start_requires_host():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    _, bob_token = join_room(store, room.id, name="B")
    set_ready(store, room.id, host_token, ready=True)
    set_ready(store, room.id, bob_token, ready=True)
    with pytest.raises(NotHost):
        start_room(store, room.id, bob_token, game_seed=42)


def test_start_requires_all_humans_ready():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    _, bob_token = join_room(store, room.id, name="B")
    set_ready(store, room.id, host_token, ready=True)
    # bob not ready
    with pytest.raises(NotAllReady):
        start_room(store, room.id, host_token, game_seed=42)


def test_start_fills_bots_and_resolves_seats():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    _, bob_token = join_room(store, room.id, name="Bob")
    set_ready(store, room.id, host_token, ready=True)
    set_ready(store, room.id, bob_token, ready=True)
    room2, game_state = start_room(store, room.id, host_token, game_seed=42)
    assert room2.status == "playing"
    assert room2.game_id == game_state.game_id
    # 4 seats total, last 2 are bots
    assert len(room2.players) == 4
    assert [p.is_bot for p in room2.players] == [False, False, True, True]
    assert game_state.players[2].is_bot is True
    assert game_state.players[2].name.startswith("Bot")


def test_terminate_only_when_paused():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    with pytest.raises(BadState):
        terminate_room(store, room.id, host_token)
    room.status = "paused"
    store.set(room)
    terminate_room(store, room.id, host_token)
    assert store.get(room.id).status == "ended"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: ImportError for the new functions.

- [ ] **Step 3: Implement**

Append to `backend/app/room.py`:

```python
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

    # Fill empty seats with bots.
    bot_idx = 0
    while len(room.players) < 4:
        seat = len(room.players)
        room.players.append(
            RoomPlayer(
                token=_new_token(),     # never broadcast; just an internal id
                seat=seat,
                name=BOT_NAMES[bot_idx],
                is_host=False,
                is_bot=True,
                ready=True,
                connected=True,         # bots are always "connected"
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_room.py -v`
Expected: 13 passed (6 from Task 2 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add backend/app/room.py backend/tests/test_room.py
git commit -m "feat(room): join/ready/start/terminate operations"
```

---

## Task 4: Broadcaster for per-viewer fan-out + heartbeat

**Files:**
- Create: `backend/app/broadcast.py`
- Create: `backend/tests/test_broadcast.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_broadcast.py
import asyncio
import pytest

from app.broadcast import Broadcaster


class FakeSocket:
    def __init__(self):
        self.sent: list[dict] = []
        self.closed = False

    async def send_json(self, payload: dict) -> None:
        if self.closed:
            raise RuntimeError("closed")
        self.sent.append(payload)


@pytest.mark.asyncio
async def test_broadcaster_sends_same_payload_to_all():
    b = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    b.attach(seat=0, ws=s0)
    b.attach(seat=1, ws=s1)
    await b.broadcast("hello", {"x": 1})
    assert s0.sent == [{"type": "hello", "x": 1}]
    assert s1.sent == [{"type": "hello", "x": 1}]


@pytest.mark.asyncio
async def test_broadcaster_per_seat_payload():
    b = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    b.attach(seat=0, ws=s0)
    b.attach(seat=1, ws=s1)
    await b.broadcast_per_seat(lambda seat: {"type": "snap", "viewer": seat})
    assert s0.sent[-1] == {"type": "snap", "viewer": 0}
    assert s1.sent[-1] == {"type": "snap", "viewer": 1}


@pytest.mark.asyncio
async def test_broadcaster_detach_silently_drops():
    b = Broadcaster()
    s0 = FakeSocket()
    b.attach(seat=0, ws=s0)
    b.detach(seat=0)
    await b.broadcast("hello", {})
    assert s0.sent == []


@pytest.mark.asyncio
async def test_broadcaster_handles_closed_socket():
    b = Broadcaster()
    s0 = FakeSocket()
    s0.closed = True
    b.attach(seat=0, ws=s0)
    # Should not raise; broken socket is auto-detached.
    await b.broadcast("hello", {})
    assert b.connected_seats() == set()
```

Add to `backend/pyproject.toml` or check `backend/requirements*.txt` for `pytest-asyncio`. If not present, install:

```bash
cd backend && ./venv/bin/pip install pytest-asyncio
```

And add a `conftest.py` if it doesn't exist:

```python
# backend/tests/conftest.py  (create if missing)
import pytest

# Use asyncio mode auto so @pytest.mark.asyncio works without strict opt-in.
pytest_plugins = ["pytest_asyncio"]
```

Also add to `backend/pytest.ini` or `pyproject.toml`:
```ini
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

(Inspect first; only add what's missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./venv/bin/pytest tests/test_broadcast.py -v`
Expected: ImportError or 4 failures (`app.broadcast` does not exist).

- [ ] **Step 3: Implement**

```python
# backend/app/broadcast.py
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Protocol


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./venv/bin/pytest tests/test_broadcast.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/broadcast.py backend/tests/test_broadcast.py backend/tests/conftest.py backend/pyproject.toml backend/pytest.ini 2>/dev/null || true
git commit -m "feat(ws): Broadcaster for per-viewer fan-out"
```

---

## Task 5: GameDriver — bot turns only

**Files:**
- Create: `backend/app/driver.py`
- Create: `backend/tests/test_driver.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_driver.py
import asyncio
import pytest

from app.broadcast import Broadcaster
from app.driver import GameDriver, HUMAN_TURN_MS
from app.game import start_game
from app.room import InMemoryRoomStore, Room, RoomPlayer
from app.store import InMemoryStore


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def send_json(self, payload):
        self.sent.append(payload)


def _seed_all_bots(game_store, room_store, seed=42):
    names = ["Bot1", "Bot2", "Bot3", "Bot4"]
    bots = [True, True, True, True]
    state = start_game(game_id="g0001", seed=seed, names=names, bots=bots)
    game_store.set(state)
    room = Room(
        id="ABCD", status="playing",
        players=[RoomPlayer(token=f"t{i}", seat=i, name=names[i],
                            is_host=(i == 0), is_bot=True, ready=True, connected=True)
                 for i in range(4)],
        game_id="g0001", created_at=0.0,
    )
    room_store.set(room)
    return state, room


@pytest.mark.asyncio
async def test_driver_runs_bots_to_completion():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)  # speed up tests
    await asyncio.wait_for(driver.run(), timeout=20)

    final = gs.get(state.game_id)
    assert final.winner_idx is not None
    kinds = [m["type"] for m in sock.sent]
    assert "bot_thinking" in kinds
    assert "action" in kinds
    assert kinds[-1] == "game_over"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py -v`
Expected: ImportError for `app.driver`.

- [ ] **Step 3: Implement**

```python
# backend/app/driver.py
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
        self._pause.set()  # not paused
        self._turn_remaining_ms: Optional[int] = None
        self._task: Optional[asyncio.Task] = None

    # ───── lifecycle ─────

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

    # ───── pause / resume / wake ─────

    def on_human_acted(self) -> None:
        self._wake.set()

    def pause(self) -> None:
        self._pause.clear()

    def resume(self) -> None:
        self._pause.set()

    # ───── main loop ─────

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
        # Stub for Task 6.
        raise NotImplementedError("human turn handling — see Task 6")

    # ───── helpers ─────

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py::test_driver_runs_bots_to_completion -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/driver.py backend/tests/test_driver.py
git commit -m "feat(driver): GameDriver bot-turn loop"
```

---

## Task 6: GameDriver — human turn + 10s auto-discard timeout

**Files:**
- Modify: `backend/app/driver.py`
- Modify: `backend/tests/test_driver.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_driver.py`:

```python
def _seed_mixed(game_store, room_store, seed=42):
    names = ["Alice", "Bot1", "Bot2", "Bot3"]
    bots = [False, True, True, True]
    state = start_game(game_id="g0002", seed=seed, names=names, bots=bots)
    game_store.set(state)
    room = Room(
        id="EFGH", status="playing",
        players=[RoomPlayer(token=f"t{i}", seat=i, name=names[i],
                            is_host=(i == 0), is_bot=bots[i],
                            ready=True, connected=True)
                 for i in range(4)],
        game_id="g0002", created_at=0.0,
    )
    room_store.set(room)
    return state, room


@pytest.mark.asyncio
async def test_human_timeout_auto_discards():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    initial_hand = list(state.players[0].hand)

    driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    # Override timeout for fast test
    from app import driver as dmod
    monkey_ms = 100
    saved = dmod.HUMAN_TURN_MS
    dmod.HUMAN_TURN_MS = monkey_ms
    try:
        # Run for enough wall time that the human turn must time out at least once.
        task = asyncio.create_task(driver.run())
        await asyncio.sleep(0.5)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    finally:
        dmod.HUMAN_TURN_MS = saved

    # Hand should have been touched (auto-discard drew back to 3 typically)
    # We at least expect a human_thinking event was emitted.
    kinds = [m["type"] for m in sock.sent]
    assert "human_thinking" in kinds


@pytest.mark.asyncio
async def test_on_human_acted_short_circuits_timeout():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)

    async def feeder():
        # Wait for human_thinking, then simulate WS handler applying a discard
        # and calling on_human_acted().
        for _ in range(50):
            await asyncio.sleep(0.01)
            kinds = [m["type"] for m in sock.sent]
            if "human_thinking" in kinds:
                break
        cur = gs.get(state.game_id)
        from app.game import discard_cards
        discard_cards(cur, 0, [cur.players[0].hand[0].id])
        driver.on_human_acted()

    task = asyncio.create_task(driver.run())
    await feeder()
    # Game should advance to bot turns
    for _ in range(200):
        cur = gs.get(state.game_id)
        if cur.turn_idx != 0 or cur.winner_idx is not None:
            break
        await asyncio.sleep(0.01)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    cur = gs.get(state.game_id)
    # Either it's now a bot's turn, or a winner emerged
    assert cur.turn_idx != 0 or cur.winner_idx is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py -v`
Expected: `NotImplementedError` from `_run_human_turn`.

- [ ] **Step 3: Implement**

Replace `_run_human_turn` in `backend/app/driver.py` and add the helper:

```python
    async def _run_human_turn(self, state: GameState, seat: int) -> None:
        budget_ms = self._turn_remaining_ms or HUMAN_TURN_MS
        deadline_ms = int(time.time() * 1000) + budget_ms
        await self.broadcaster.broadcast(
            "human_thinking", {"player": seat, "deadline_ms": deadline_ms}
        )

        self._wake.clear()
        started = time.monotonic()
        try:
            await asyncio.wait_for(self._wake.wait(), timeout=budget_ms / 1000)
            # Human acted; WS handler already mutated state.
            self._turn_remaining_ms = None
            # Re-fetch and rebroadcast the action snapshot if the handler didn't
            # already (the handler is expected to). Either way we re-loop.
            return
        except asyncio.TimeoutError:
            self._turn_remaining_ms = None
            kind, events = self._auto_discard(state, seat)
            await self._broadcast_action(state, seat, kind, events)
        except asyncio.CancelledError:
            # External cancel (pause / shutdown) — preserve remaining time.
            elapsed_ms = (time.monotonic() - started) * 1000
            if not self._pause.is_set():
                self._turn_remaining_ms = max(0, budget_ms - int(elapsed_ms))
            raise

    def _auto_discard(self, state: GameState, seat: int) -> tuple[str, list[str]]:
        hand = state.players[seat].hand
        if not hand:
            return "pass", pass_turn(state, seat)
        rng = random.Random(state.seed + state.turn_idx * 101 + len(state.event_log))
        chosen = rng.choice(hand)
        events = discard_cards(state, seat, [chosen.id])
        events = [f"P{seat} timed out — auto-discarded"] + events
        return "discard", events
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/driver.py backend/tests/test_driver.py
git commit -m "feat(driver): human turn + 10s auto-discard timeout"
```

---

## Task 7: GameDriver — pause/resume with preserved remaining ms

**Files:**
- Modify: `backend/app/driver.py`
- Modify: `backend/tests/test_driver.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_driver.py`:

```python
@pytest.mark.asyncio
async def test_pause_blocks_loop_then_resume_continues():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs)
    bc = Broadcaster()
    bc.attach(seat=0, ws=FakeSocket())

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    driver.pause()
    task = asyncio.create_task(driver.run())
    await asyncio.sleep(0.2)
    assert not task.done()  # blocked on pause
    driver.resume()
    await asyncio.wait_for(task, timeout=20)
    final = gs.get(state.game_id)
    assert final.winner_idx is not None


@pytest.mark.asyncio
async def test_pause_during_human_turn_preserves_remaining_ms():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    bc.attach(seat=0, ws=FakeSocket())

    from app import driver as dmod
    saved = dmod.HUMAN_TURN_MS
    dmod.HUMAN_TURN_MS = 500
    try:
        driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                            game_store=gs, room_store=rs, broadcaster=bc,
                            floor_ms=0)
        task = asyncio.create_task(driver.run())
        await asyncio.sleep(0.2)  # ~200ms into the 500ms budget
        driver.pause()
        # cancel the inner wait_for via _pause_interrupt path:
        driver._cancel_current_wait()
        await asyncio.sleep(0.1)
        remaining = driver._turn_remaining_ms
        assert remaining is not None
        assert 150 <= remaining <= 400  # generous bounds
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    finally:
        dmod.HUMAN_TURN_MS = saved
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py -v -k pause`
Expected: AttributeError (`_cancel_current_wait` not defined) or the pause test failing because the loop doesn't actually wake up after resume cleanly.

- [ ] **Step 3: Implement**

Add to `GameDriver` in `backend/app/driver.py`:

```python
    # In __init__, also initialize:
    #   self._current_wait: Optional[asyncio.Task] = None
```

Adjust `_run_human_turn` so the inner `wait_for` is cancelable from outside:

```python
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
                # Paused mid-turn — preserve remainder.
                self._turn_remaining_ms = max(0, budget_ms - int(elapsed_ms))
            else:
                self._turn_remaining_ms = None
            # Don't re-raise: the outer `run` loop should keep going (it will
            # block on `_pause.wait()` if paused).
            return
        finally:
            if self._current_wait and not self._current_wait.done():
                self._current_wait.cancel()
            self._current_wait = None

    def _cancel_current_wait(self) -> None:
        """Used by `pause()` to interrupt an in-flight human turn."""
        if self._current_wait and not self._current_wait.done():
            self._current_wait.cancel()
```

Make `pause()` call `_cancel_current_wait()`:

```python
    def pause(self) -> None:
        self._pause.clear()
        self._cancel_current_wait()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/driver.py backend/tests/test_driver.py
git commit -m "feat(driver): pause/resume preserves human turn remainder"
```

---

## Task 8: Per-viewer snapshot fairness test

**Files:**
- Modify: `backend/tests/test_driver.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.asyncio
async def test_per_viewer_snapshots_hide_other_hands():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs)
    bc = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    bc.attach(seat=0, ws=s0)
    bc.attach(seat=1, ws=s1)

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    await asyncio.wait_for(driver.run(), timeout=20)

    actions0 = [m for m in s0.sent if m["type"] == "action"]
    actions1 = [m for m in s1.sent if m["type"] == "action"]
    assert actions0 and actions1
    snap0 = actions0[-1]["snapshot"]
    snap1 = actions1[-1]["snapshot"]
    assert snap0["viewer_idx"] == 0
    assert snap1["viewer_idx"] == 1
    # In each snapshot, only the viewer's hand is visible.
    assert snap0["players"][0]["hand"] is not None
    assert snap0["players"][1]["hand"] is None
    assert snap1["players"][1]["hand"] is not None
    assert snap1["players"][0]["hand"] is None
```

- [ ] **Step 2: Run to verify it passes immediately**

Run: `cd backend && ./venv/bin/pytest tests/test_driver.py::test_per_viewer_snapshots_hide_other_hands -v`
Expected: PASS — `_broadcast_action` already uses `broadcast_per_seat`. This is a regression-guard test.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_driver.py
git commit -m "test(driver): per-viewer snapshot fairness regression"
```

---

## Task 9: REST router for rooms

**Files:**
- Create: `backend/app/room_api.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_room_api.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_room_api.py
from fastapi.testclient import TestClient

from app.main import app, ROOM_STORE  # noqa: F401  (will exist after Task 9 impl)


def _reset():
    for r in list(ROOM_STORE.iter_rooms()):
        ROOM_STORE.delete(r.id)


def test_post_room_returns_host_token_and_seat():
    _reset()
    client = TestClient(app)
    r = client.post("/api/rooms", json={"host_name": "Alice"})
    assert r.status_code == 200
    body = r.json()
    assert "room_id" in body
    assert "player_token" in body
    assert body["seat"] == 0
    assert body["ws_url"].startswith("/ws/rooms/")


def test_get_room_omits_tokens():
    _reset()
    client = TestClient(app)
    created = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    r = client.get(f"/api/rooms/{created['room_id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "lobby"
    assert all("token" not in p for p in body["players"])


def test_join_then_ready_then_start():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "Bob"}
    ).json()
    assert bob["seat"] == 1

    # Bob is not host: start should 403.
    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": bob["player_token"]},
    )
    assert r.status_code == 403

    # Not all ready: 400.
    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": host["player_token"], "ready": True},
    )
    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": host["player_token"]},
    )
    assert r.status_code == 400

    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": bob["player_token"], "ready": True},
    )
    r = client.post(
        f"/api/rooms/{host['room_id']}/start",
        json={"player_token": host["player_token"]},
    )
    assert r.status_code == 200
    assert "game_id" in r.json()


def test_join_returns_409_when_full():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    for name in ("B", "C", "D"):
        client.post(f"/api/rooms/{host['room_id']}/join", json={"name": name})
    r = client.post(f"/api/rooms/{host['room_id']}/join", json={"name": "E"})
    assert r.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./venv/bin/pytest tests/test_room_api.py -v`
Expected: ImportError (ROOM_STORE/router not wired) or 404s.

- [ ] **Step 3: Implement**

Create `backend/app/room_api.py`:

```python
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
from .store import GameStore


class CreateRoomBody(BaseModel):
    host_name: str


class JoinBody(BaseModel):
    name: str


class ReadyBody(BaseModel):
    player_token: str
    ready: bool


class TokenBody(BaseModel):
    player_token: str


def _public_view(room) -> dict[str, Any]:
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
    start_driver,    # callable(room_id, game_id) -> None  (Task 11 wires this)
):
    router = APIRouter(prefix="/api/rooms")

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
        return {
            "player_token": token,
            "seat": room.players[-1].seat,
            "ws_url": f"/ws/rooms/{room.id}",
        }

    @router.post("/{room_id}/ready")
    async def ready(room_id: str, body: ReadyBody) -> dict[str, Any]:
        try:
            set_ready(room_store_getter(), room_id, body.player_token, ready=body.ready)
        except RoomError as e:
            raise _http(e)
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
        start_driver(room.id, state.game_id)
        return {"game_id": state.game_id}

    @router.post("/{room_id}/terminate")
    async def terminate(room_id: str, body: TokenBody) -> dict[str, Any]:
        try:
            terminate_room(room_store_getter(), room_id, body.player_token)
        except RoomError as e:
            raise _http(e)
        return {"ok": True}

    return router
```

Modify `backend/app/main.py`:

```python
# Replace existing content. Keep solo /api/games for backwards compat.
from __future__ import annotations

import os
import random
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .game import start_game
from .room import InMemoryRoomStore
from .room_api import make_room_router
from .snapshot import public_snapshot
from .store import GameStore, InMemoryStore


app = FastAPI(title="Antibody Politics")
STORE: GameStore = InMemoryStore()
ROOM_STORE = InMemoryRoomStore()
DRIVERS: dict[str, Any] = {}   # room_id → GameDriver
BROADCASTERS: dict[str, Any] = {}  # room_id → Broadcaster
HUMAN_IDX = 0
DEFAULT_NAMES = ["You", "Bot Alpha", "Bot Bravo", "Bot Charlie"]


class CreateGameBody(BaseModel):
    seed: Optional[int] = None
    names: Optional[list[str]] = None


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/games")
async def create_game(body: CreateGameBody) -> dict[str, Any]:
    seed = body.seed if body.seed is not None else random.randint(0, 2**31 - 1)
    names = body.names if body.names else DEFAULT_NAMES
    if len(names) != 4:
        raise HTTPException(400, "exactly 4 names required")
    game_id = uuid.uuid4().hex[:8]
    state = start_game(game_id=game_id, seed=seed, names=names, bots=[False, True, True, True])
    STORE.set(state)
    snap = public_snapshot(state, viewer_idx=HUMAN_IDX)
    return {"game_id": game_id, "ws_url": f"/ws/games/{game_id}", "snapshot": snap, "seed": seed}


@app.get("/api/games/{game_id}/snapshot")
async def get_snapshot(game_id: str) -> dict[str, Any]:
    state = STORE.get(game_id)
    if state is None:
        raise HTTPException(404, "game not found")
    return public_snapshot(state, viewer_idx=HUMAN_IDX)


def _start_room_driver(room_id: str, game_id: str) -> None:
    # Wired fully in Task 11 (lifespan + ws integration).
    from .broadcast import Broadcaster
    from .driver import GameDriver

    bc = BROADCASTERS.setdefault(room_id, Broadcaster())
    driver = GameDriver(
        room_id=room_id, game_id=game_id,
        game_store=STORE, room_store=ROOM_STORE, broadcaster=bc,
    )
    DRIVERS[room_id] = driver
    driver.start()


app.include_router(
    make_room_router(
        room_store_getter=lambda: ROOM_STORE,
        game_store_getter=lambda: STORE,
        start_driver=_start_room_driver,
    )
)


from .ws import make_ws_router  # noqa: E402

app.include_router(make_ws_router(lambda: STORE))


@app.on_event("shutdown")
async def _shutdown() -> None:
    for d in list(DRIVERS.values()):
        await d.cancel()


_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(_DIST / "index.html")

    @app.get("/join/{room_id}")
    async def join_html(room_id: str) -> FileResponse:
        # Serve SPA index so client-side routing handles /join/<id>.
        return FileResponse(_DIST / "index.html")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_room_api.py -v`
Expected: 4 passed. (The `start_driver` callback creates a real driver and starts it — that's fine; the tests don't wait on game completion.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/room_api.py backend/tests/test_room_api.py
git commit -m "feat(api): room REST endpoints"
```

---

## Task 10: WebSocket route `/ws/rooms/{id}?token=…`

**Files:**
- Modify: `backend/app/ws.py`
- Modify: `backend/app/main.py` (pass dicts to ws router)
- Create: `backend/tests/test_ws_multiplayer.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_ws_multiplayer.py
from fastapi.testclient import TestClient

from app.main import app, BROADCASTERS, DRIVERS, ROOM_STORE, STORE


def _reset():
    for r in list(ROOM_STORE.iter_rooms()):
        ROOM_STORE.delete(r.id)
    DRIVERS.clear()
    BROADCASTERS.clear()


def test_lobby_socket_receives_room_state():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws:
        msg = ws.receive_json()
        assert msg["type"] == "room_state"
        assert msg["my_seat"] == 0
        assert msg["room"]["status"] == "lobby"


def test_unknown_token_closes_with_error():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "Alice"}).json()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token=deadbeef"
    ) as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["code"] == "bad_token"


def test_two_humans_both_receive_action():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "B"}
    ).json()
    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": host["player_token"], "ready": True},
    )
    client.post(
        f"/api/rooms/{host['room_id']}/ready",
        json={"player_token": bob["player_token"], "ready": True},
    )

    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws_a, client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
    ) as ws_b:
        # Eat the initial room_state on each
        ws_a.receive_json()
        ws_b.receive_json()
        client.post(
            f"/api/rooms/{host['room_id']}/start",
            json={"player_token": host["player_token"]},
        )
        # Both receive a snapshot on game start (driver broadcasts initial action / thinking)
        # We accept any of: snapshot, human_thinking, action, bot_thinking.
        a = ws_a.receive_json()
        b = ws_b.receive_json()
        assert a["type"] in ("snapshot", "human_thinking", "bot_thinking", "action")
        assert b["type"] in ("snapshot", "human_thinking", "bot_thinking", "action")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./venv/bin/pytest tests/test_ws_multiplayer.py -v`
Expected: failure — `/ws/rooms/...` route doesn't exist yet.

- [ ] **Step 3: Implement**

Replace `backend/app/ws.py` entirely:

```python
from __future__ import annotations

import asyncio
import time
from typing import Any, Callable

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .broadcast import Broadcaster
from .driver import GameDriver
from .game import discard_cards, pass_turn, play_card
from .room import Room, RoomStore
from .rules import IllegalAction
from .snapshot import public_snapshot
from .store import GameStore

HUMAN_IDX = 0
BOT_FLOOR_MS = 1000


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


def make_ws_router(store_getter, room_store_getter=None, broadcasters=None, drivers=None) -> APIRouter:
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

        # Solo is just a 1-seat broadcaster + driver wrapper.
        bc = Broadcaster()
        bc.attach(seat=HUMAN_IDX, ws=ws)
        # Lazy: each solo game gets its own driver per connect; cancel on disconnect.
        # No room store in solo flow — pass None where unused.
        from .room import InMemoryRoomStore
        driver = GameDriver(
            room_id=f"solo-{game_id}", game_id=game_id,
            game_store=store, room_store=InMemoryRoomStore(), broadcaster=bc,
        )
        driver_task = driver.start()

        # Send initial snapshot
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
                await bc.broadcast_per_seat(
                    lambda viewer: {
                        "type": "action", "player": HUMAN_IDX, "kind": kind,
                        "events": events, "snapshot": public_snapshot(cur, viewer_idx=viewer),
                    }
                )
                driver.on_human_acted()
        except WebSocketDisconnect:
            pass
        finally:
            await driver.cancel()

    # ─────────── Room /ws/rooms/{id}?token=… ───────────

    if room_store_getter is not None:
        @router.websocket("/ws/rooms/{room_id}")
        async def room_socket(
            ws: WebSocket, room_id: str, token: str = Query(...)
        ) -> None:
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

            # Mark connected; if room was paused for this seat, resume.
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

            # Initial event: lobby vs in-game.
            if room.status == "lobby":
                await _broadcast_lobby(bc, room)
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
                    await bc.broadcast_per_seat(
                        lambda viewer: {
                            "type": "action", "player": seat, "kind": kind,
                            "events": events, "snapshot": public_snapshot(state, viewer_idx=viewer),
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
```

Modify `backend/app/main.py` `make_ws_router` call:

Replace:
```python
app.include_router(make_ws_router(lambda: STORE))
```
with:
```python
app.include_router(
    make_ws_router(
        lambda: STORE,
        room_store_getter=lambda: ROOM_STORE,
        broadcasters=BROADCASTERS,
        drivers=DRIVERS,
    )
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./venv/bin/pytest tests/test_ws_multiplayer.py tests/test_room_api.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ws.py backend/app/main.py backend/tests/test_ws_multiplayer.py
git commit -m "feat(ws): /ws/rooms/{id} route with per-viewer broadcast"
```

---

## Task 11: Disconnect → pause → reconnect integration test

**Files:**
- Modify: `backend/tests/test_ws_multiplayer.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
def test_disconnect_pauses_and_reconnect_resumes():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "B"}
    ).json()
    for tok in (host["player_token"], bob["player_token"]):
        client.post(
            f"/api/rooms/{host['room_id']}/ready",
            json={"player_token": tok, "ready": True},
        )

    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws_a:
        ws_a.receive_json()  # room_state

        ws_b = client.websocket_connect(
            f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
        )
        with ws_b as wsb:
            wsb.receive_json()  # room_state
            client.post(
                f"/api/rooms/{host['room_id']}/start",
                json={"player_token": host["player_token"]},
            )
            ws_a.receive_json()  # initial driver event
            wsb.receive_json()
        # wsb is now closed.

        # Server marks paused.
        msg = ws_a.receive_json()
        assert msg["type"] == "paused"
        assert 1 in msg["waiting_for_seats"]

        # Bob reconnects.
        with client.websocket_connect(
            f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
        ) as wsb2:
            wsb2.receive_json()  # snapshot (in-game now)
            msg2 = ws_a.receive_json()
            assert msg2["type"] == "resumed"


def test_host_terminate_while_paused():
    _reset()
    client = TestClient(app)
    host = client.post("/api/rooms", json={"host_name": "A"}).json()
    bob = client.post(
        f"/api/rooms/{host['room_id']}/join", json={"name": "B"}
    ).json()
    for tok in (host["player_token"], bob["player_token"]):
        client.post(
            f"/api/rooms/{host['room_id']}/ready",
            json={"player_token": tok, "ready": True},
        )

    with client.websocket_connect(
        f"/ws/rooms/{host['room_id']}?token={host['player_token']}"
    ) as ws_a:
        ws_a.receive_json()
        with client.websocket_connect(
            f"/ws/rooms/{host['room_id']}?token={bob['player_token']}"
        ) as wsb:
            wsb.receive_json()
            client.post(
                f"/api/rooms/{host['room_id']}/start",
                json={"player_token": host["player_token"]},
            )
            ws_a.receive_json()
            wsb.receive_json()
        # Bob disconnected, paused
        ws_a.receive_json()  # paused

        r = client.post(
            f"/api/rooms/{host['room_id']}/terminate",
            json={"player_token": host["player_token"]},
        )
        assert r.status_code == 200
        room = client.get(f"/api/rooms/{host['room_id']}").json()
        assert room["status"] == "ended"
```

- [ ] **Step 2: Run tests to verify they fail or pass**

Run: `cd backend && ./venv/bin/pytest tests/test_ws_multiplayer.py -v`
Expected: pass — the route logic implemented in Task 10 already handles pause/resume/terminate. If these tests reveal bugs (race conditions, ordering), fix in `ws.py` and re-run.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_ws_multiplayer.py
git commit -m "test(ws): disconnect→pause→resume and host terminate"
```

---

## Task 12: Frontend types — room + new server events

**Files:**
- Modify: `frontend/src/game/types.ts`

- [ ] **Step 1: Edit `types.ts`**

Append:

```ts
export type RoomStatus = "lobby" | "playing" | "paused" | "ended";

export interface RoomPlayerView {
  seat: number;
  name: string;
  is_host: boolean;
  is_bot: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomView {
  id: string;
  status: RoomStatus;
  game_id: string | null;
  players: RoomPlayerView[];
  paused_for: number[];
}
```

Extend `ServerEvent`:

```ts
export type ServerEvent =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "bot_thinking"; player: number; expected_ms: number }
  | { type: "human_thinking"; player: number; deadline_ms: number }
  | { type: "action"; player: number; kind: "play" | "discard" | "pass"; events: string[]; snapshot: Snapshot }
  | { type: "game_over"; winner_idx: number; snapshot: Snapshot }
  | { type: "room_state"; my_seat: number; room: RoomView }
  | { type: "paused"; waiting_for_seats: number[] }
  | { type: "resumed" }
  | { type: "terminated" }
  | { type: "error"; code: string; message: string };
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (untyped existing code may produce warnings; only fix breakage you caused).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/types.ts
git commit -m "feat(types): RoomView + multiplayer server events"
```

---

## Task 13: Room REST helpers + new ws connector

**Files:**
- Create: `frontend/src/game/room.ts`
- Modify: `frontend/src/game/ws.ts`

- [ ] **Step 1: Implement `frontend/src/game/room.ts`**

```ts
import type { RoomView } from "./types";

export interface CreateRoomResult {
  room_id: string;
  player_token: string;
  seat: number;
  ws_url: string;
}

export interface JoinRoomResult {
  player_token: string;
  seat: number;
  ws_url: string;
}

async function jsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${r.status}`);
  }
  return r.json();
}

export async function createRoom(hostName: string): Promise<CreateRoomResult> {
  const r = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_name: hostName }),
  });
  return jsonOrThrow<CreateRoomResult>(r);
}

export async function joinRoom(roomId: string, name: string): Promise<JoinRoomResult> {
  const r = await fetch(`/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow<JoinRoomResult>(r);
}

export async function getRoom(roomId: string): Promise<RoomView> {
  const r = await fetch(`/api/rooms/${roomId}`);
  return jsonOrThrow<RoomView>(r);
}

export async function setReady(
  roomId: string,
  playerToken: string,
  ready: boolean,
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken, ready }),
    }),
  );
}

export async function startRoom(
  roomId: string,
  playerToken: string,
): Promise<{ game_id: string }> {
  return jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken }),
    }),
  );
}

export async function terminateRoom(roomId: string, playerToken: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/rooms/${roomId}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken }),
    }),
  );
}

const TOKEN_KEY = (roomId: string) => `mp:${roomId}`;

export function storeToken(roomId: string, token: string): void {
  localStorage.setItem(TOKEN_KEY(roomId), token);
}

export function loadToken(roomId: string): string | null {
  return localStorage.getItem(TOKEN_KEY(roomId));
}
```

- [ ] **Step 2: Add `connectRoomWs` to `frontend/src/game/ws.ts`**

Replace file contents:

```ts
import { useStore } from "./store";
import type { ServerEvent } from "./types";

export function connectWs(gameId: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/games/${gameId}`);
  wireWs(ws, () => connectWs(gameId), () => gameId);
  return ws;
}

export function connectRoomWs(roomId: string, token: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(
    `${proto}://${location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`,
  );
  wireWs(ws, () => connectRoomWs(roomId, token), () => roomId);
  return ws;
}

function wireWs(ws: WebSocket, reconnect: () => void, idOf: () => string) {
  let pinger: number | null = null;
  ws.onmessage = (e) => {
    const ev = JSON.parse(e.data) as ServerEvent | { type: "ping" };
    if ((ev as any).type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }
    useStore.getState().applyServerEvent(ev as ServerEvent);
  };
  ws.onopen = () => {
    useStore.getState().attach(idOf(), ws);
    pinger = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" })); // client→server keepalive
      }
    }, 20000);
  };
  ws.onclose = () => {
    if (pinger) window.clearInterval(pinger);
    const snap = useStore.getState().snapshot;
    if (!snap || snap.winner_idx == null) {
      setTimeout(reconnect, 1000);
    }
  };
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/room.ts frontend/src/game/ws.ts
git commit -m "feat(client): room REST helpers + WS connector"
```

---

## Task 14: Store — multiplayer fields and event handlers

**Files:**
- Modify: `frontend/src/game/store.ts`

- [ ] **Step 1: Edit `store.ts`**

Add fields and event cases. Replace the file with:

```ts
import { create } from "zustand";
import type { ClientMessage, RoomView, ServerEvent, Snapshot } from "./types";

type ConnStatus = "idle" | "connecting" | "open" | "closed";

interface State {
  conn: { status: ConnStatus; ws: WebSocket | null };
  snapshot: Snapshot | null;
  gameId: string | null;
  events: string[];
  selection: string[];
  pendingTargets: Record<string, unknown> | null;
  theme: "light" | "dark";
  animSpeed: number;
  soundOn: boolean;
  botThinking: { player: number | null; since: number };
  toast: string | null;

  // Multiplayer
  room: RoomView | null;
  mySeat: number | null;
  playerToken: string | null;
  turnDeadline: number | null;
  isPaused: boolean;
  waitingFor: number[];
  terminated: boolean;

  setSnapshot: (s: Snapshot) => void;
  pushEvents: (e: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setPendingTargets: (t: Record<string, unknown> | null) => void;
  setTheme: (t: "light" | "dark") => void;
  setBotThinking: (p: number | null) => void;
  setToast: (m: string | null) => void;
  attach: (gameId: string, ws: WebSocket) => void;
  send: (msg: ClientMessage) => void;
  applyServerEvent: (ev: ServerEvent) => void;

  setRoomContext: (roomId: string, token: string, seat: number) => void;
  setRoom: (room: RoomView, mySeat: number) => void;
  clearRoom: () => void;
}

const initialTheme: "light" | "dark" =
  (typeof localStorage !== "undefined" && (localStorage.getItem("theme") as "light" | "dark")) || "dark";

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", initialTheme);
}

export const useStore = create<State>((set, get) => ({
  conn: { status: "idle", ws: null },
  snapshot: null,
  gameId: null,
  events: [],
  selection: [],
  pendingTargets: null,
  theme: initialTheme,
  animSpeed: Number(localStorage.getItem("animSpeed") ?? "1"),
  soundOn: localStorage.getItem("soundOn") !== "0",
  botThinking: { player: null, since: 0 },
  toast: null,

  room: null,
  mySeat: null,
  playerToken: null,
  turnDeadline: null,
  isPaused: false,
  waitingFor: [],
  terminated: false,

  setSnapshot: (s) => set({ snapshot: s }),
  pushEvents: (e) => set((st) => ({ events: [...st.events, ...e].slice(-40) })),
  toggleSelect: (id) =>
    set((st) => {
      if (st.selection.includes(id)) return { selection: st.selection.filter((x) => x !== id) };
      if (st.selection.length >= 3) return st;
      return { selection: [...st.selection, id] };
    }),
  clearSelection: () => set({ selection: [], pendingTargets: null }),
  setPendingTargets: (t) => set({ pendingTargets: t }),
  setTheme: (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
    set({ theme: t });
  },
  setBotThinking: (p) => set({ botThinking: { player: p, since: p == null ? 0 : performance.now() } }),
  setToast: (m) => set({ toast: m }),

  attach: (gameId, ws) => set({ gameId, conn: { status: "open", ws } }),
  send: (msg) => {
    const ws = get().conn.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  },

  setRoomContext: (roomId, token, seat) =>
    set({ gameId: roomId, playerToken: token, mySeat: seat }),
  setRoom: (room, mySeat) => set({ room, mySeat }),
  clearRoom: () =>
    set({
      room: null, mySeat: null, playerToken: null,
      isPaused: false, waitingFor: [], terminated: false, turnDeadline: null,
    }),

  applyServerEvent: (ev) => {
    if (ev.type === "snapshot") {
      set({ snapshot: ev.snapshot });
    } else if (ev.type === "action") {
      set((st) => ({
        snapshot: ev.snapshot,
        events: [...st.events, ...ev.events].slice(-40),
        botThinking: { player: null, since: 0 },
        selection: [],
        pendingTargets: null,
        turnDeadline: null,
      }));
    } else if (ev.type === "bot_thinking") {
      set({ botThinking: { player: ev.player, since: performance.now() }, turnDeadline: null });
    } else if (ev.type === "human_thinking") {
      set({ botThinking: { player: null, since: 0 }, turnDeadline: ev.deadline_ms });
    } else if (ev.type === "room_state") {
      set({ room: ev.room, mySeat: ev.my_seat });
    } else if (ev.type === "paused") {
      set({ isPaused: true, waitingFor: ev.waiting_for_seats });
    } else if (ev.type === "resumed") {
      set({ isPaused: false, waitingFor: [] });
    } else if (ev.type === "terminated") {
      set({ terminated: true, isPaused: false });
    } else if (ev.type === "game_over") {
      set((st) => ({
        snapshot: ev.snapshot,
        events: [...st.events, `Winner: ${ev.snapshot.players[ev.winner_idx]?.name ?? "?"}`].slice(-40),
        toast: "Game over",
      }));
    } else if (ev.type === "error") {
      set({ toast: ev.message });
    }
  },
}));
```

- [ ] **Step 2: Write a Vitest unit test**

Create `frontend/src/game/__tests__/store.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "../store";

describe("store multiplayer events", () => {
  beforeEach(() => {
    useStore.getState().clearRoom();
  });

  it("room_state stores room + mySeat", () => {
    useStore.getState().applyServerEvent({
      type: "room_state",
      my_seat: 1,
      room: {
        id: "AB12", status: "lobby", game_id: null,
        players: [
          { seat: 0, name: "Alice", is_host: true, is_bot: false, ready: false, connected: true },
          { seat: 1, name: "Bob",   is_host: false, is_bot: false, ready: false, connected: true },
        ],
        paused_for: [],
      },
    });
    expect(useStore.getState().mySeat).toBe(1);
    expect(useStore.getState().room?.id).toBe("AB12");
  });

  it("paused/resumed toggles isPaused", () => {
    const s = useStore.getState();
    s.applyServerEvent({ type: "paused", waiting_for_seats: [1] });
    expect(useStore.getState().isPaused).toBe(true);
    expect(useStore.getState().waitingFor).toEqual([1]);
    s.applyServerEvent({ type: "resumed" });
    expect(useStore.getState().isPaused).toBe(false);
  });

  it("human_thinking sets turnDeadline", () => {
    useStore.getState().applyServerEvent({
      type: "human_thinking", player: 0, deadline_ms: 12345,
    });
    expect(useStore.getState().turnDeadline).toBe(12345);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd frontend && npm test`
Expected: 3 tests passing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/store.ts frontend/src/game/__tests__/store.test.ts
git commit -m "feat(store): multiplayer slice + event handlers"
```

---

## Task 15: MultiplayerLanding + JoinRoom pages

**Files:**
- Create: `frontend/src/pages/MultiplayerLanding.tsx`
- Create: `frontend/src/pages/JoinRoom.tsx`

- [ ] **Step 1: Implement `MultiplayerLanding.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { createRoom, storeToken } from "../game/room";

export default function MultiplayerLanding({
  onCreated,
  onCancel,
}: {
  onCreated: (roomId: string, token: string, seat: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(localStorage.getItem("mp:lastName") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await createRoom(name);
      storeToken(r.room_id, r.player_token);
      localStorage.setItem("mp:lastName", name);
      onCreated(r.room_id, r.player_token, r.seat);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen text-text"
         style={{ background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)" }}>
      <motion.h1
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="font-chunky text-5xl mb-8 text-accent">CREATE ROOM</motion.h1>
      <input
        autoFocus
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="px-4 py-3 rounded-lg text-black w-72 text-lg" />
      {err && <p className="mt-3 text-red-400">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="font-chunky tracking-widest px-6 py-3 rounded-full border border-white/30">
          BACK
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="font-chunky tracking-widest px-8 py-3 rounded-full bg-accent text-bg disabled:opacity-50">
          {busy ? "CREATING…" : "CREATE"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `JoinRoom.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { joinRoom, storeToken } from "../game/room";

export default function JoinRoom({
  roomId,
  onJoined,
  onCancel,
}: {
  roomId: string;
  onJoined: (roomId: string, token: string, seat: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(localStorage.getItem("mp:lastName") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await joinRoom(roomId, name);
      storeToken(roomId, r.player_token);
      localStorage.setItem("mp:lastName", name);
      onJoined(roomId, r.player_token, r.seat);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen text-text"
         style={{ background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)" }}>
      <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                 className="font-chunky text-4xl mb-2 text-accent">JOIN ROOM</motion.h1>
      <p className="opacity-70 mb-6 tracking-widest">Room <strong>{roomId}</strong></p>
      <input
        autoFocus
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="px-4 py-3 rounded-lg text-black w-72 text-lg" />
      {err && <p className="mt-3 text-red-400">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="font-chunky tracking-widest px-6 py-3 rounded-full border border-white/30">
          CANCEL
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="font-chunky tracking-widest px-8 py-3 rounded-full bg-accent text-bg disabled:opacity-50">
          {busy ? "JOINING…" : "JOIN"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MultiplayerLanding.tsx frontend/src/pages/JoinRoom.tsx
git commit -m "feat(ui): MultiplayerLanding + JoinRoom pages"
```

---

## Task 16: Lobby page

**Files:**
- Create: `frontend/src/pages/Lobby.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useStore } from "../game/store";
import { Avatar } from "../components/Avatar";
import { setReady, startRoom } from "../game/room";

export default function Lobby({
  roomId,
  token,
  onStarted,
  onLeave,
}: {
  roomId: string;
  token: string;
  onStarted: () => void;
}) {
  const room = useStore((s) => s.room);
  const mySeat = useStore((s) => s.mySeat);

  const me = useMemo(
    () => room?.players.find((p) => p.seat === mySeat) ?? null,
    [room, mySeat],
  );
  const isHost = !!me?.is_host;
  const allReady = room?.players.every((p) => p.ready) ?? false;
  const inviteUrl = `${location.origin}/join/${roomId}`;

  // When room flips to playing, transition.
  useEffect(() => {
    if (room?.status === "playing") onStarted();
  }, [room?.status, onStarted]);

  async function toggleReady() {
    if (!me) return;
    await setReady(roomId, token, !me.ready);
  }

  async function start() {
    await startRoom(roomId, token);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    useStore.getState().setToast("Invite link copied");
    setTimeout(() => useStore.getState().setToast(null), 2000);
  }

  if (!room) return <div className="h-screen w-screen grid place-items-center text-text">Loading…</div>;

  return (
    <div className="h-screen w-screen text-text"
         style={{ background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)" }}>
      <div className="max-w-2xl mx-auto pt-10 px-4">
        <h1 className="font-chunky text-4xl mb-2 text-accent">ROOM {room.id}</h1>
        <p className="opacity-70 mb-8">Waiting for players… empty seats become bots when you start.</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {[0, 1, 2, 3].map((seat) => {
            const p = room.players.find((x) => x.seat === seat);
            return (
              <motion.div
                key={seat}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 flex items-center gap-3 bg-white/5 border border-white/10">
                {p ? (
                  <>
                    <Avatar seed={p.name} size={48} />
                    <div className="flex-1">
                      <div className="font-chunky tracking-wider">
                        {p.name} {p.is_host && <span className="text-accent">★</span>}
                      </div>
                      <div className="text-xs opacity-60">
                        {p.is_bot ? "BOT" : p.ready ? "READY" : "Not ready"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-dashed border-white/20" />
                    <div className="flex-1 italic opacity-50">Empty (will be filled by bot)</div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={copyInvite}
                  className="font-chunky tracking-widest px-6 py-3 rounded-full border border-white/30">
            COPY INVITE
          </button>
          <button onClick={toggleReady}
                  className={`font-chunky tracking-widest px-6 py-3 rounded-full
                    ${me?.ready ? "bg-white/20" : "bg-accent text-bg"}`}>
            {me?.ready ? "UNREADY" : "READY"}
          </button>
          {isHost && (
            <button onClick={start} disabled={!allReady}
                    className="font-chunky tracking-widest px-8 py-3 rounded-full bg-accent text-bg disabled:opacity-40">
              START
            </button>
          )}
          <button onClick={onLeave}
                  className="font-chunky tracking-widest px-6 py-3 rounded-full border border-white/30">
            LEAVE
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Lobby.tsx
git commit -m "feat(ui): Lobby page"
```

---

## Task 17: TurnTimer + PauseOverlay components

**Files:**
- Create: `frontend/src/components/TurnTimer.tsx`
- Create: `frontend/src/components/PauseOverlay.tsx`

- [ ] **Step 1: Implement `TurnTimer.tsx`**

```tsx
import { useEffect, useState } from "react";

export function TurnTimer({ deadlineMs }: { deadlineMs: number | null }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (deadlineMs == null) {
      setRemaining(0);
      return;
    }
    function tick() {
      setRemaining(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    }
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  if (deadlineMs == null) return null;

  const pct = Math.max(0, Math.min(100, ((deadlineMs - Date.now()) / 10000) * 100));
  return (
    <div className="inline-flex items-center gap-2 font-chunky tracking-widest text-sm">
      <svg width="20" height="20" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="16" fill="none"
          stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 100.5} 100.5`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span>{remaining}s</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement `PauseOverlay.tsx`**

```tsx
import { useStore } from "../game/store";
import { terminateRoom } from "../game/room";

export function PauseOverlay() {
  const isPaused = useStore((s) => s.isPaused);
  const waitingFor = useStore((s) => s.waitingFor);
  const room = useStore((s) => s.room);
  const mySeat = useStore((s) => s.mySeat);
  const token = useStore((s) => s.playerToken);
  const terminated = useStore((s) => s.terminated);

  if (!isPaused && !terminated) return null;

  const waitingNames = waitingFor
    .map((seat) => room?.players.find((p) => p.seat === seat)?.name)
    .filter(Boolean)
    .join(", ");
  const isHost = !!room?.players.find((p) => p.seat === mySeat)?.is_host;

  async function terminate() {
    if (!room || !token) return;
    await terminateRoom(room.id, token);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center text-text p-6">
      <div className="max-w-md bg-bg/90 border border-white/10 rounded-2xl p-8 text-center">
        {terminated ? (
          <>
            <h2 className="font-chunky text-3xl text-accent mb-2">GAME TERMINATED</h2>
            <p className="opacity-70">The host ended this game.</p>
          </>
        ) : (
          <>
            <h2 className="font-chunky text-3xl text-accent mb-2">PAUSED</h2>
            <p className="mb-6">Waiting for <strong>{waitingNames || "player"}</strong> to reconnect…</p>
            {isHost && (
              <button onClick={terminate}
                      className="font-chunky tracking-widest px-6 py-3 rounded-full border border-red-400 text-red-300">
                TERMINATE GAME
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TurnTimer.tsx frontend/src/components/PauseOverlay.tsx
git commit -m "feat(ui): TurnTimer + PauseOverlay components"
```

---

## Task 18: App.tsx — screen state machine + path routing

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import { useEffect, useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";
import MultiplayerLanding from "./pages/MultiplayerLanding";
import JoinRoom from "./pages/JoinRoom";
import Lobby from "./pages/Lobby";
import { useStore } from "./game/store";
import { connectRoomWs, connectWs } from "./game/ws";
import { loadToken } from "./game/room";

type Screen = "home" | "mp_landing" | "join" | "lobby" | "game";

function detectInitialScreen(): { screen: Screen; roomId?: string } {
  const m = location.pathname.match(/^\/join\/([A-Z0-9]{4})$/i);
  if (m) return { screen: "join", roomId: m[1].toUpperCase() };
  return { screen: "home" };
}

export default function App() {
  const initial = detectInitialScreen();
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId ?? null);
  const setRoomContext = useStore((s) => s.setRoomContext);
  const clearRoom = useStore((s) => s.clearRoom);

  // If we arrived via /join/XXXX and already have a token, jump straight into lobby.
  useEffect(() => {
    if (initial.screen === "join" && initial.roomId) {
      const t = loadToken(initial.roomId);
      if (t) {
        setRoomContext(initial.roomId, t, -1);
        connectRoomWs(initial.roomId, t);
        setScreen("lobby");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSoloGame(gameId: string) {
    setScreen("game");
    // existing solo path already connected ws inside NewGame.tsx; reuse.
  }

  function onMpCreated(rid: string, token: string, seat: number) {
    setRoomContext(rid, token, seat);
    connectRoomWs(rid, token);
    setRoomId(rid);
    setScreen("lobby");
  }

  function onJoined(rid: string, token: string, seat: number) {
    setRoomContext(rid, token, seat);
    connectRoomWs(rid, token);
    setRoomId(rid);
    setScreen("lobby");
  }

  function leaveLobby() {
    clearRoom();
    history.replaceState({}, "", "/");
    setScreen("home");
  }

  if (screen === "mp_landing")
    return <MultiplayerLanding onCreated={onMpCreated} onCancel={() => setScreen("home")} />;
  if (screen === "join" && roomId)
    return <JoinRoom roomId={roomId} onJoined={onJoined} onCancel={() => { history.replaceState({}, "", "/"); setScreen("home"); }} />;
  if (screen === "lobby" && roomId)
    return <Lobby roomId={roomId} token={useStore.getState().playerToken!} onStarted={() => setScreen("game")} onLeave={leaveLobby} />;
  if (screen === "game") return <Game />;
  return <NewGame onStart={startSoloGame} onMultiplayer={() => setScreen("mp_landing")} />;
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: complaints about `NewGame onMultiplayer` prop being missing — fixed in Task 19.

- [ ] **Step 3: Commit (defer until Task 19 to keep build green)**

Skip commit; bundle with Task 19.

---

## Task 19: NewGame — MULTIPLAYER secondary CTA

**Files:**
- Modify: `frontend/src/pages/NewGame.tsx`

- [ ] **Step 1: Update the function signature and CTA block**

Edit the component signature to accept `onMultiplayer`:

Replace:
```tsx
export default function NewGame({ onStart }: { onStart: (gameId: string) => void }) {
```
with:
```tsx
export default function NewGame({
  onStart, onMultiplayer,
}: { onStart: (gameId: string) => void; onMultiplayer: () => void }) {
```

Find the existing "CTA" section (the `<motion.button onClick={start} …>DEAL</motion.button>`) and add a secondary button below it:

```tsx
        <motion.button
          onClick={onMultiplayer}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="font-chunky text-sm tracking-[0.3em] rounded-full px-8 py-3 border border-white/40 text-white/90"
        >
          MULTIPLAYER
        </motion.button>
```

Place it inside the same flex column under the DEAL button so it appears stacked.

- [ ] **Step 2: Type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/NewGame.tsx
git commit -m "feat(ui): MULTIPLAYER entry + screen routing"
```

---

## Task 20: Game.tsx — embed TurnTimer + PauseOverlay

**Files:**
- Modify: `frontend/src/pages/Game.tsx`

- [ ] **Step 1: Read current `Game.tsx` to find the right insertion points**

Run: `cd frontend && head -60 src/pages/Game.tsx`

Find:
1. Where the active player's avatar or seat indicator renders — place `<TurnTimer deadlineMs={turnDeadline} />` next to it when that seat is the human's turn.
2. The top-level return — render `<PauseOverlay />` as a sibling at the end.

- [ ] **Step 2: Add imports + usage**

Add at the top of `Game.tsx`:
```tsx
import { TurnTimer } from "../components/TurnTimer";
import { PauseOverlay } from "../components/PauseOverlay";
```

Add to the destructured store selection (or read `turnDeadline` via `useStore`):
```tsx
const turnDeadline = useStore((s) => s.turnDeadline);
```

In the JSX, render the timer near the seat banner (look for where `botThinking` is consumed today — the timer renders the same way for humans):
```tsx
{turnDeadline != null && <TurnTimer deadlineMs={turnDeadline} />}
```

At the bottom of the top-level return, before the closing tag, add:
```tsx
<PauseOverlay />
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Game.tsx
git commit -m "feat(ui): turn timer + pause overlay in Game"
```

---

## Task 21: ngrok tunnel script + README

**Files:**
- Create: `scripts/tunnel.sh`
- Modify: `README.md`

- [ ] **Step 1: Create the script**

```bash
# scripts/tunnel.sh
#!/usr/bin/env bash
set -e
command -v ngrok >/dev/null || {
  echo "ngrok not found. Install: brew install ngrok/ngrok/ngrok"
  echo "Then sign up at https://dashboard.ngrok.com to grab an authtoken."
  exit 1
}
echo "→ Forwarding http://127.0.0.1:8001"
echo "→ Make sure ./run.sh is running in another terminal."
ngrok http 8001 --log=stdout
```

Then:
```bash
chmod +x scripts/tunnel.sh
```

- [ ] **Step 2: Update README**

Read current README and find a sensible section (likely under "Run / dev" or a new "Play with friends" heading). Append (or add):

```markdown
## Play with friends (ngrok)

To host a multiplayer game accessible to friends over the internet:

1. In one terminal: `./run.sh` (boots backend on `:8001`).
2. In another: `./scripts/tunnel.sh` (forwards `:8001` through ngrok).
3. Share the `https://*.ngrok-free.app/` URL ngrok prints — friends create or join a room from that URL.

The host taps **MULTIPLAYER → CREATE**, copies the invite link from the lobby, and shares it. The host taps **START** once everyone is **READY**.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/tunnel.sh README.md
git commit -m "feat(infra): ngrok tunnel script + README notes"
```

---

## Task 22: Manual end-to-end verification

- [ ] **Step 1: Start backend in dev mode**

```bash
./run.sh dev
```

Open `http://127.0.0.1:5173/`.

- [ ] **Step 2: Solo regression**

Click **DEAL** → confirm the existing 1-human-vs-3-bots game still works end-to-end (a few turns, see bots play, see your hand). No regressions vs. master.

- [ ] **Step 3: Multiplayer happy path (single browser, two windows)**

1. Window A (host): click **MULTIPLAYER → CREATE**, enter "Alice". Lobby appears.
2. Copy the invite link (button).
3. Window B (guest): open invite link in a private window or different browser, enter "Bob". Lands in lobby.
4. Both tap **READY**.
5. Window A taps **START**.
6. Both windows see a 4-player board: 2 humans + 2 bots (Bot Alpha, Bot Bravo). Each window shows only its own hand. Avatars differ per name.
7. On a human's turn, see the 10s timer ring. Wait — confirm auto-discard fires.

- [ ] **Step 4: Disconnect/resume**

1. Mid-game, close window B.
2. Window A: shows **PAUSED — Waiting for Bob…**. Bots also halted.
3. Reopen the invite link in window B (token stored in localStorage takes over) — confirm Bob lands back in his seat and play resumes.

- [ ] **Step 5: Host terminate**

1. Cause a pause again (close B).
2. In Window A, click **TERMINATE GAME**. Both windows show "Game terminated".

- [ ] **Step 6: ngrok end-to-end (optional, requires ngrok auth)**

```bash
./scripts/tunnel.sh
```

Share the printed URL with a friend or open it on a phone over cellular. Repeat steps 3–4 above.

- [ ] **Step 7: Backend full test suite**

```bash
cd backend && ./venv/bin/pytest -v
```
Expected: green.

- [ ] **Step 8: Frontend tests**

```bash
cd frontend && npm test
```
Expected: green.

- [ ] **Step 9: Commit any final fixups**

If verification revealed UI polish issues, fix them and:
```bash
git add -A
git commit -m "fix(ui): polish from end-to-end verification"
```

---

## Self-review notes

- **Spec coverage:** Room model (T1), id/name validation (T2), join/ready/start/terminate (T3), Broadcaster (T4), driver bot+human+pause (T5–T7), per-viewer fairness (T8), REST (T9), WS (T10), disconnect/terminate integration (T11), client types/REST/ws (T12–T13), store (T14), MP/Join/Lobby pages (T15–T16), TurnTimer/PauseOverlay (T17), routing (T18–T19), Game integration (T20), ngrok (T21), manual verify (T22). All spec sections accounted for.
- **No placeholders:** every code step contains actual code or exact commands.
- **Type consistency:** `RoomView`, `ServerEvent`, `room`/`mySeat`/`playerToken`/`turnDeadline`/`isPaused` field names match between `types.ts`, `store.ts`, and the React components.
- **Deferred to future work (out of scope, per spec §14):** spectator mode, Redis store, rematch, mid-game seat swap, name moderation. The plan does NOT include these.
