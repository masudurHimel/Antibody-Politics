# Tasks — Antibody Politics Phase 1

High-level roadmap. The detailed execution plan (one bullet per commit/PR) is produced by the `writing-plans` skill after this spec is approved and will live alongside this file.

- **Status legend:** ☐ todo · ◐ in progress · ☑ done · ✗ dropped
- **Last updated:** 2026-05-16

---

## Milestone 0 — Project bootstrap

- ☐ Initialize `backend/` with FastAPI app, `requirements.txt`, `venv/`
- ☐ Initialize `frontend/` with Vite + React + TS + Tailwind + Framer Motion + Zustand
- ☐ Write `run.sh` (default / `dev` / `clean` modes)
- ☐ Rewrite `CLAUDE.md` to reflect new architecture + working principles + pointer to `docs/specs/`
- ☐ Add `docs/changelog.md` initial entry
- ☐ Commit project skeleton

## Milestone 1 — Game engine (rules, deck, turn loop)

- ☐ `models.py` with all enums, Card, Organ (computed status), Player, GameState
- ☐ `deck.py` with canonical 68-card composition + reshuffle helper
- ☐ `rules.py`: `apply_play` + `legal_targets` for ORGAN, VIRUS, MEDICINE
- ☐ `rules.py`: all 5 TREATMENT kinds with full target schemas
- ☐ `game.py`: turn loop (play / discard / pass → check_winner → draw → advance)
- ☐ `snapshot.py`: `public_snapshot` with hidden-info masking
- ☐ `store.py`: `GameStore` protocol + `InMemoryStore`
- ☐ `tests/test_rules.py` covers every card type + all edge cases listed in spec §10
- ☐ `tests/test_engine.py` runs 1000 random-policy games to termination

## Milestone 2 — Bot AI

- ☐ `bot.py` heuristic scorer with all weights from spec §7.2
- ☐ `bot.py` MCTS-lite overlay with trigger conditions + budget enforcement
- ☐ Fast `RolloutState` for inner loop (lightweight non-Pydantic)
- ☐ Fairness invariant: bot receives snapshot only; tampered-snapshot test raises
- ☐ `tests/test_bot.py` tournament asserts hybrid > 55% vs heuristic-only over 100 games
- ☐ Tune weights via tournament runs; commit final values

## Milestone 3 — Backend API surface

- ☐ `main.py`: FastAPI app, lifespan, mount static `frontend/dist`
- ☐ HTTP routes: `POST /api/games`, `GET /api/games/{id}/snapshot`, `GET /api/health`
- ☐ `ws.py`: `/ws/games/{id}` gateway, event router, validation
- ☐ Bot turn driver: on bot's turn, emit `bot_thinking`, compute, wait floor, emit `action`
- ☐ Graceful client disconnect handling; reconnect = re-send latest snapshot
- ☐ Error event for invalid client messages; connection stays open

## Milestone 4 — Frontend foundation

- ☐ Tailwind config with theme tokens (light + dark)
- ☐ Zustand store slices (connection, game, ui, bot)
- ☐ WebSocket client with reconnect-on-drop + initial snapshot fetch
- ☐ Snapshot reducer + selector hooks
- ☐ `Game.tsx` page skeleton: center table, four seats, side panel placeholder
- ☐ `NewGame.tsx` start screen with bot-name presets

## Milestone 5 — Card rendering + UI components

- ☐ Procedural SVG `<CardFront>` and `<CardBack>` with pictogram set
- ☐ `<Hand>` with fanned layout + hover lift
- ☐ `<OrganRow>` with up to 4 organ slots + attached cards
- ☐ `<BoardSeat>` for bots: avatar, hand-count chip, organ row, thinking indicator
- ☐ `<ActivityLog>` showing last 4 events with fade-out
- ☐ `<ThemeToggle>` with persisted localStorage state
- ☐ Settings panel (sound, animation speed)
- ☐ Toast strip for transient events

## Milestone 6 — Animations + polish

- ☐ Deal animation: arc + stagger from deck to each seat
- ☐ Play animation: lift + flip + Bezier flight to target slot + elastic land
- ☐ Discard animation: rotate-arc to discard pile
- ☐ Draw animation: deck → hand position
- ☐ Bot thinking: avatar pulse + ellipsis + deck wiggle
- ☐ State overlays: infected pulse, vaccinated halo, immunized shimmer
- ☐ Win sequence: confetti + dim others + banner
- ☐ Theme transition cross-fade
- ☐ Honor `prefers-reduced-motion`

## Milestone 7 — Integration + acceptance

- ☐ End-to-end manual run: deal → bot plays → human plays → win
- ☐ All 13 success criteria in spec §13 verified
- ☐ Update `CLAUDE.md` with any drift from spec
- ☐ Final commit; tag `v0.1-phase-1`

## Phase 2 (deferred — out of scope here)

- ✗ Auth + lobbies
- ✗ Redis-backed `GameStore` swap
- ✗ Reconnect grace + bot-takeover
- ✗ Spectator mode
- ✗ Match history persistence
