# CLAUDE.md

Guidance for Claude Code working in this repo.

## Run / dev

- `./run.sh` — production-ish: builds frontend if needed, serves on `127.0.0.1:8001`.
- `./run.sh dev` — uvicorn (reload) on `:8001` + Vite (HMR) on `:5173` with proxy.
- `./run.sh clean` — wipe venv, node_modules, dist.

The repo serves a single port (`:8001`) in default mode. Frontend Vite dev server uses `:5173` and proxies `/api` + `/ws` to the backend.

## Tests

- Backend: `cd backend && ./venv/bin/pytest`
- Frontend: `cd frontend && npm test`
- Bot tournament: `./venv/bin/pytest tests/test_bot.py -k tournament -v`

## Architecture (Phase 1)

Single FastAPI process implementing 1-human-vs-3-bots Virus!. WebSocket-first communication. All state in memory behind a `GameStore` protocol so Phase 2 can swap to Redis.

### Backend layering (`backend/app/`) — each layer is importable without the one above:

1. `models.py` — Pydantic models, enums, computed `Organ.status`, `Player.has_won()`.
2. `deck.py` — Canonical 68-card deck builder + reshuffle-on-empty.
3. `rules.py` — **The rule book.** Pure functions: `apply_play(state, idx, card_id, targets)` and `legal_targets(state, idx, card)`. Sole mutation site for organs and hands.
4. `game.py` — Turn loop: `play_card` / `discard_cards` / `pass_turn` → `check_winner` → draw → `advance_turn`.
5. `snapshot.py` — `public_snapshot(state, viewer_idx)`. The only shape leaving the engine; other players' hands become `hand_count`.
6. `store.py` — `GameStore` protocol + `InMemoryStore`.
7. `bot.py` — `choose_action(snapshot, my_seat)`. Hybrid policy: weighted heuristics + MCTS-lite overlay on high-stakes branches. Receives **snapshot only**, never full state.
8. `ws.py` — WebSocket gateway, event router, bot turn driver (emits `bot_thinking`, computes, waits floor, emits `action`).
9. `main.py` — FastAPI app, HTTP routes, lifespan, mounts `frontend/dist` as static in prod mode.

### Frontend (`frontend/src/`)

- `game/` — Zustand store, WebSocket client (reconnect-on-drop), action dispatchers, TS types.
- `cards/` — Procedural SVG card renderer (no PNG assets).
- `components/` — `Hand`, `OrganRow`, `BoardSeat`, `ActivityLog`, `ThemeToggle`, `Toast`, `Settings`, `Banner`.
- `anim/` — Framer Motion shared variants.
- `pages/` — `Game.tsx` (in-game), `NewGame.tsx` (start screen).
- `styles/index.css` — Tailwind + theme custom-property defs.

### Invariants

- **`rules.py` is the only place that mutates organs/hands.** `game.py` orchestrates but never reaches into `Player.body` / `Player.hand` directly.
- **`Organ.status` is computed**, never assigned. Mutate `attached` and let the property recompute.
- **`public_snapshot` is the only shape leaving the server.** Bots receive the same shape humans do.
- **Bots get a snapshot, never `GameState`.** Fairness asserted in `test_bot.py`.
- **No optimistic updates on the client.** Server is authoritative; UI renders the last snapshot.

## Docs

- Spec: `docs/specs/spec.md`
- Decisions (ADRs): `docs/specs/decisions.md`
- Task roadmap: `docs/specs/tasks.md`
- Implementation plan: `docs/specs/plan.md`
- Changelog: `docs/changelog.md`

## Working principles

Behavioral guidelines to reduce common LLM coding mistakes. For trivial tasks, use judgment.

### 1. Think before coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.

### 2. Simplicity first
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

### 3. Surgical changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style.
- Remove imports/variables/functions that your changes made unused; leave pre-existing dead code alone unless asked.

### 4. Goal-driven execution
Define success criteria. Loop until verified.
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."
