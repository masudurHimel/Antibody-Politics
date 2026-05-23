# Multiplayer Rooms — Design

**Date:** 2026-05-21
**Status:** Approved (pending user review of this doc)
**Scope:** Add a room-based multiplayer mode (1–4 humans + bot fill to 4 seats), shareable via an ngrok-forwarded URL. Existing solo mode (1 human vs 3 bots via `POST /api/games`) is preserved unchanged.

---

## 1. Goals

- A host can create a room and share a URL like `https://<ngrok>/join/AB12`.
- 1–4 humans (host included) gather in a lobby, each tap **Ready**, then the host taps **Start**.
- Empty seats are filled with bots so every game is 4-handed.
- Joiners get a procedurally generated avatar (reusing the existing `Avatar` component).
- Per-turn 10-second deadline for human turns; on timeout the server auto-discards one card and advances.
- If any human disconnects mid-game, the room pauses; the host can either wait for reconnect or terminate.
- Reconnect (refresh, brief drop) restores the seat using a secret `player_token` stored in `localStorage`.
- A helper script forwards the local backend port through ngrok.

## 2. Non-goals

- No persistent accounts, friends list, or matchmaking.
- No spectator mode in this phase (flagged as future work; the room model leaves room for it).
- No Redis / cross-process state. In-memory only, behind `RoomStore` protocol so Phase 2 can swap.
- No mid-game join (lobby locks at Start).
- No mid-game seat swap (a bot cannot be claimed by a latecomer).

## 3. Architecture overview

Existing engine (`models.py`, `deck.py`, `rules.py`, `game.py`, `snapshot.py`, `bot.py`) is unchanged. The CLAUDE.md invariants remain intact:

- `rules.py` is still the sole mutation site for organs/hands.
- Bots still receive `public_snapshot`, never `GameState`.
- The server is still authoritative; clients render the last snapshot.

New backend layer sits **above** `game.py`:

```
ws layer  ──────────  per-token WebSocket  /ws/rooms/{id}?token=…
                       │
                       ▼
driver       ──────  GameDriver (one asyncio.Task per active game)
                       │ owns: turn loop, bot moves, 10s human timer,
                       │        pause/resume gate, per-viewer broadcast
                       ▼
room         ──────  Room model + RoomStore protocol
                       │ owns: lobby state, player_token → seat,
                       │        host identity, status transitions
                       ▼
engine       ──────  unchanged: game.py / rules.py / snapshot.py / bot.py
```

`POST /api/games` (solo) still works; it bypasses the room layer entirely.

## 4. Room model

```python
# backend/app/room.py (new)
class RoomPlayer(BaseModel):
    token: str          # 32-char hex; secret; never broadcast
    seat: int           # 0..3
    name: str           # 1..20 chars, stripped
    is_host: bool
    is_bot: bool = False
    ready: bool = False
    connected: bool = False

class Room(BaseModel):
    id: str                          # 4-char [A-HJ-NP-Z2-9], no ambiguous chars
    status: Literal["lobby","playing","paused","ended"]
    players: list[RoomPlayer]        # 1..4
    game_id: str | None = None       # set on transition to playing
    paused_for: list[int] = []       # seats waiting to reconnect (when paused)
    created_at: float
```

**Identity & storage**
- `id`: 4 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I). On collision with an active room, regenerate.
- `token`: `secrets.token_hex(16)`. Returned exactly once on create/join. Stored client-side in `localStorage["mp:<room_id>"] = token`.
- `RoomStore` protocol mirrors `GameStore`: `get`, `set`, `delete`, `list_active`. `InMemoryRoomStore` for now.

**Lifecycle**
```
LOBBY → PLAYING → ENDED
          ↕
        PAUSED
```
- LOBBY → PLAYING: host calls `/start`, all humans `ready`, ≥1 player present. Empty seats filled with bots (`Bot Alpha`, `Bot Bravo`, … using existing default names for the remaining count). `start_game` is called with the resolved name+bot arrays. `game_id = state.game_id`. A `GameDriver` task is started.
- PLAYING → PAUSED: any human's WS closes. Driver's `_pause` event clears; the loop awaits resume at its next iteration. `paused_for` is updated.
- PAUSED → PLAYING: all `paused_for` seats reconnect (same token).
- PLAYING/PAUSED → ENDED: winner found, OR host calls `/terminate` while paused.

## 5. REST surface

All bodies/returns JSON. All non-success cases use HTTP 4xx with `{detail}`.

| Method + Path | Body | Returns |
|---|---|---|
| `POST /api/rooms` | `{host_name: str}` | `{room_id, player_token, seat: 0, ws_url}` |
| `GET /api/rooms/{id}` | — | `{id, status, players: [{seat,name,is_host,is_bot,ready,connected}], game_id}` (no tokens) |
| `POST /api/rooms/{id}/join` | `{name: str}` | `{player_token, seat, ws_url}` — 409 if full or status≠lobby |
| `POST /api/rooms/{id}/ready` | `{player_token, ready: bool}` | `{ok: true}` |
| `POST /api/rooms/{id}/start` | `{player_token}` | `{game_id}` — host only; 400 if any human not ready |
| `POST /api/rooms/{id}/terminate` | `{player_token}` | `{ok: true}` — host only; status must be `paused` |

Existing `POST /api/games` is unchanged and continues to power the solo flow.

**Name hygiene:** server strips leading/trailing whitespace and caps at 20 chars. Empty name → 400. No profanity filter in this phase.

**Rate limiting:** simple per-IP token bucket on `POST /api/rooms/{id}/join` (e.g., 5 joins per 30s) so the public ngrok URL isn't trivially abusable. In-memory dict keyed by `request.client.host`.

## 6. WebSocket protocol

**URL:** `GET /ws/rooms/{room_id}?token=<player_token>`

On accept, server resolves `token → seat` and registers the socket in the room's broadcast set. On any error (bad token, unknown room) → send `{type:"error", code, message}` and close.

### Server → client events

| type | when | payload |
|---|---|---|
| `room_state` | on connect; on any lobby change | `{room: <GET /api/rooms/{id} shape>, my_seat}` |
| `snapshot` | on transition to playing; on resume | `{snapshot}` (per-viewer) |
| `bot_thinking` | bot turn begins | `{player, expected_ms}` |
| `human_thinking` *(new)* | human turn begins | `{player, deadline_ms}` — server wall-clock target |
| `action` | any seat acts | `{player, kind, events, snapshot}` (per-viewer snapshot) |
| `paused` *(new)* | a human dropped | `{waiting_for_seats: [int]}` |
| `resumed` *(new)* | all humans reconnected | `{}` |
| `terminated` *(new)* | host killed paused game | `{}` |
| `game_over` | winner | `{winner_idx, snapshot}` |
| `error` | bad action / illegal / bad payload | `{code, message}` |

### Client → server messages (unchanged from solo)

`play` / `discard` / `pass`. Server validates `state.turn_idx == seat_for(token)`.

### Per-viewer snapshot fan-out

When the driver emits an `action` or `snapshot`, it iterates connected sockets and computes `public_snapshot(state, viewer_idx=that_socket.seat)` per socket. `snapshot.py` already supports this — the current solo path just always passes `viewer_idx=0`.

### Heartbeats

Server sends `{type:"ping"}` every 20s; client echoes `{type:"pong"}`. Without this, both the Vite dev proxy and ngrok idle-close long-running sockets.

## 7. GameDriver (new)

```python
# backend/app/driver.py (new)
class GameDriver:
    def __init__(self, room_id: str, game_id: str,
                 store: GameStore, room_store: RoomStore,
                 broadcast: Callable[[str, dict], Awaitable[None]]):
        self.room_id = room_id
        self.game_id = game_id
        self.store = store
        self.room_store = room_store
        self._broadcast_raw = broadcast    # (type, payload) → awaitable; fan-out lives in the caller
        self._task: asyncio.Task | None = None
        self._wake = asyncio.Event()       # set when a human acts
        self._pause = asyncio.Event()      # set = running, cleared = paused
        self._pause.set()
        self._turn_remaining_ms: int | None = None  # preserved across pause

    async def run(self):
        while True:
            await self._pause.wait()
            state = self.store.get(self.game_id)
            if state is None or state.winner_idx is not None:
                if state and state.winner_idx is not None:
                    await self._broadcast_game_over(state)
                return

            seat = state.turn_idx
            player = state.players[seat]

            if player.is_bot:
                await self._broadcast("bot_thinking", {"player": seat, "expected_ms": 1500})
                started = time.monotonic()
                snap = public_snapshot(state, viewer_idx=seat)
                kind, payload = await asyncio.to_thread(choose_action, snap, seat)
                try:
                    events = self._apply_bot_move(state, seat, kind, payload)
                except IllegalAction:
                    events = self._fallback_bot_move(state, seat)
                elapsed_ms = (time.monotonic() - started) * 1000
                if elapsed_ms < BOT_FLOOR_MS:
                    await asyncio.sleep((BOT_FLOOR_MS - elapsed_ms) / 1000.0)
                await self._broadcast_action(state, seat, kind, events)
            else:
                budget_ms = self._turn_remaining_ms or HUMAN_TURN_MS  # 10000
                deadline_ms = now_ms() + budget_ms
                await self._broadcast("human_thinking",
                                      {"player": seat, "deadline_ms": deadline_ms})
                started = time.monotonic()
                try:
                    # wait_for is canceled by pause via outer task wrap (see below)
                    await asyncio.wait_for(self._wake.wait(), timeout=budget_ms / 1000)
                    self._wake.clear()
                    self._turn_remaining_ms = None  # human acted in time
                except asyncio.TimeoutError:
                    self._turn_remaining_ms = None
                    self._auto_discard_one(state, seat)  # deterministic RNG
                except _PauseInterrupt:
                    elapsed_ms = (time.monotonic() - started) * 1000
                    self._turn_remaining_ms = max(0, budget_ms - int(elapsed_ms))
                    continue  # back to top, await pause

    def on_human_acted(self): self._wake.set()
    def pause(self):  self._pause.clear()  # also raises _PauseInterrupt into wait_for
    def resume(self): self._pause.set()
```

**Pause semantics:** when `pause()` is called during a human's `wait_for`, the driver cancels the inner wait and records elapsed time. On `resume()`, the loop iterates again, sees `_turn_remaining_ms > 0`, and rebroadcasts `human_thinking` with a fresh `deadline_ms` reflecting the preserved remainder.

**Timeout action:** auto-discard one card chosen by `random.Random(state.seed + state.turn_idx * 101 + len(state.event_log)).choice(player.hand)`. Deterministic for reproducibility; calls existing `discard_cards`.

**Constants:** `HUMAN_TURN_MS = 10000`, `BOT_FLOOR_MS = 1000` (existing).

## 8. WebSocket handler shape (`ws.py` rewrite)

The handler becomes thin:

1. Accept WS. Parse `token` from query. Resolve `room`, `seat`. If unknown → error + close.
2. Mark player `connected=True`. If room was `paused` and `paused_for` is now empty → driver.resume(); broadcast `resumed`.
3. Send initial `room_state` (lobby) or `snapshot` (playing/paused).
4. Loop on receive:
   - `play` / `discard` / `pass`: validate `state.turn_idx == seat`. Apply via existing `play_card/discard_cards/pass_turn`. Broadcast `action`. Call `driver.on_human_acted()`.
   - `pong`: ignore.
   - else: send `error`.
5. On disconnect: mark `connected=False`. If status is `playing`, set status `paused`, append seat to `paused_for`, `driver.pause()`, broadcast `paused`.

The current inline `_drive_bots` function is **removed** from `ws.py`; that logic lives only in `GameDriver` now.

## 9. Frontend

### Routing

The app currently switches between `NewGame` and `Game` via top-level state in `App.tsx`. We extend that switch with:

- `mp_landing` — name input + Create Room
- `lobby` — pre-game room view
- `join` — when URL path is `/join/<room_id>` on initial load
- `game` — existing in-game screen

Path-based dispatch on first load: if `location.pathname` matches `^/join/([A-Z0-9]{4})$`, go to `join`; else `NewGame`.

### New pages

- `pages/MultiplayerLanding.tsx`: name input (default from `localStorage["mp:lastName"]`) → "Create Room". POST `/api/rooms`, save `player_token`, navigate to `lobby`.
- `pages/JoinRoom.tsx`: read `room_id` from path, name input → POST `/api/rooms/{id}/join`, save token, navigate to `lobby`. Show errors (`room not found`, `room is full`, `game already started`).
- `pages/Lobby.tsx`: shows 4 seat slots. Filled seats: avatar + name + ready chip + host crown. Empty seats: "(will be filled by bot)". Controls:
  - Ready / Unready toggle (everyone, calls `/ready`)
  - Copy invite link (everyone): writes `${origin}/join/${room_id}` to clipboard
  - Start (host only, enabled when all humans `ready`)

### Existing pages

- `pages/NewGame.tsx`: add a secondary CTA below DEAL: **MULTIPLAYER**. Same visual language (smaller, outlined). Navigates to `mp_landing`.
- `pages/Game.tsx`: gains
  - Pause overlay: when `room.status == "paused"`, full-screen modal "Waiting for *<name>*…" + (host only) "Terminate game" button.
  - Turn timer ring: a 10-second circular countdown drawn around the active player's avatar when `human_thinking` is active. Bots keep the existing thinking shimmer.

### Store changes (`game/store.ts`)

New fields:
```ts
room: Room | null;
mySeat: number | null;
playerToken: string | null;
turnDeadline: number | null;    // wall-clock ms for the active human turn
isPaused: boolean;
```
New `applyServerEvent` cases: `room_state`, `human_thinking`, `paused`, `resumed`, `terminated`.

`connectWs(roomId, token)` is a second variant pointing at `/ws/rooms/{roomId}?token=...`.

### Avatars

Reuse `components/Avatar.tsx`. Seed with `player.name` so each human gets a stable picture across reloads. No new assets.

## 10. ngrok tunnel

```bash
# scripts/tunnel.sh (new)
#!/usr/bin/env bash
set -e
command -v ngrok >/dev/null || { echo "Install ngrok: brew install ngrok/ngrok/ngrok"; exit 1; }
echo "Forwarding 127.0.0.1:8001 — make sure ./run.sh is running in another terminal."
ngrok http 8001 --log=stdout
```

README gains a short paragraph: "To play with friends: run `./run.sh` in one terminal, `./scripts/tunnel.sh` in another, share the `https://*.ngrok-free.app/` URL."

Not auto-starting `./run.sh` from the script keeps the two concerns composable (Vite vs prod build, port choice, etc.).

## 11. Testing

New files:

- `backend/tests/test_room.py`
  - create room with host_name → returns token + seat 0
  - join up to 4; 5th join is 409
  - join when status≠lobby is 409
  - host-only start; start with un-ready human is 400
  - ready toggle
  - room-id collision retries
  - name validation (empty, oversized, whitespace)

- `backend/tests/test_driver.py`
  - bot-only game (all four bots) completes through driver
  - human seat times out → discard occurs + turn advances
  - `pause()` halts the loop; `resume()` continues
  - timer remainder is preserved across pause/resume
  - per-viewer broadcast: snapshots received by seat 0 socket hide hands for seats 1–3

- `backend/tests/test_ws_multiplayer.py` (integration; uses `TestClient.websocket_connect`)
  - two humans join → both receive `room_state`
  - both ready → host starts → both receive `snapshot`
  - one human plays → both receive `action` with their own viewer snapshot
  - one socket disconnects → other receives `paused`
  - same token reconnects → both receive `resumed`
  - host calls `/terminate` while paused → both receive `terminated`

Existing tests remain green; engine code is not touched.

## 12. Risks & decisions

| Risk | Decision |
|---|---|
| ngrok URL is publicly reachable; bored stranger spams `/join` | Per-IP token bucket on `/join`; room id is 4 chars but unguessable enough for casual play. Not a security boundary. |
| Two browsers on the same machine share `localStorage` → reconnect collision | Token stored under `mp:<room_id>` key. Different rooms isolated. Same browser rejoining same room → seamless reconnect (the desired behavior). |
| Driver task survives if WS layer crashes | `GameDriver` is owned by `RoomManager`; on FastAPI shutdown all driver tasks are cancelled in `lifespan`. |
| `paused` deadlock if host themselves disconnects | If host's seat is the one paused-for, terminate UI is not reachable. Mitigation: host's reconnect path is the same — they refresh and rejoin. If host abandons the room entirely → room is GC'd after 1 hour of paused inactivity (background sweep). |
| Bot fairness | Bots still receive only `public_snapshot`. `test_bot.py` fairness assertion unaffected. |

## 13. File-by-file change summary

**New files**
- `backend/app/room.py` — `Room`, `RoomPlayer`, `RoomStore`, `InMemoryRoomStore`, room CRUD logic (create/join/ready/start/terminate). Name validation. Pure functions where possible.
- `backend/app/driver.py` — `GameDriver` class, `HUMAN_TURN_MS`, deterministic auto-discard.
- `backend/tests/test_room.py`, `backend/tests/test_driver.py`, `backend/tests/test_ws_multiplayer.py`
- `frontend/src/pages/MultiplayerLanding.tsx`
- `frontend/src/pages/JoinRoom.tsx`
- `frontend/src/pages/Lobby.tsx`
- `frontend/src/components/TurnTimer.tsx` — 10s circular countdown ring
- `frontend/src/components/PauseOverlay.tsx`
- `scripts/tunnel.sh`

**Modified files**
- `backend/app/main.py` — register room router; instantiate `RoomStore`; lifespan cancels driver tasks on shutdown.
- `backend/app/ws.py` — gain `/ws/rooms/{id}` route; remove inline `_drive_bots` (logic moves to `GameDriver`); `/ws/games/{id}` solo route retained for backwards compatibility (delegates to a single-player adapter that wraps `GameDriver` with one human at seat 0).
- `backend/app/game.py` — no changes.
- `backend/app/snapshot.py` — no changes.
- `backend/app/rules.py` — no changes.
- `backend/app/bot.py` — no changes.
- `frontend/src/App.tsx` — path-based initial route; switch over `mp_landing | join | lobby | game`.
- `frontend/src/pages/NewGame.tsx` — add MULTIPLAYER secondary CTA.
- `frontend/src/pages/Game.tsx` — TurnTimer + PauseOverlay integration.
- `frontend/src/game/store.ts` — room/mySeat/playerToken/turnDeadline/isPaused fields; new event handlers.
- `frontend/src/game/ws.ts` — `connectRoomWs(roomId, token)` variant; pong handler.
- `README.md` — short ngrok paragraph.

## 14. Future work (out of scope)

- Spectator sockets (`seat=null`).
- Redis-backed `RoomStore` / `GameStore` for multi-process.
- In-room rematch button (currently game ends → room ends; player rebuilds a room).
- Mid-game seat swap (latecomer takes a bot).
- Profanity filter / name moderation.
