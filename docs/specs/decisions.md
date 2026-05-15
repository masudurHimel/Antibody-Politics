# Architectural Decisions

Lightweight ADRs. One row per decision. Update **Status** when reversing or superseding.

- **Status legend:** Accepted · Superseded · Rejected
- **Last updated:** 2026-05-16

---

## ADR-0001 — Frontend stack: React + Vite + Tailwind + Framer Motion

- **Status:** Accepted
- **Context:** Phase 1 ships a single-player SPA; Phase 2 adds multiplayer WebSocket flows. We need "modern top-notch UI" with rich card animations and a stack that won't need rewriting at Phase 2.
- **Decision:** React 18 + Vite + TypeScript + Tailwind + Framer Motion + Zustand.
- **Alternatives considered:**
  - SvelteKit — smaller ecosystem and awkward to pair with a separate FastAPI backend.
  - Vanilla JS + GSAP — fastest to start but state management for Phase 2 becomes painful.
  - Next.js 14 — SSR adds complexity without payoff for a game SPA.
- **Consequences:** Requires a Node toolchain. Standard React patterns; large library availability for any UI primitives we need.

## ADR-0002 — Backend stack: FastAPI + Pydantic v2 + uvicorn

- **Status:** Accepted
- **Context:** Need Python backend (user preference). Need both HTTP and WebSocket on the same process. Need typed models that double as the wire format.
- **Decision:** FastAPI with native WebSocket support. Pydantic v2 models are the wire format; `model_dump(mode="json")` produces what the client expects.
- **Alternatives considered:**
  - Flask + Flask-Sock — workable but FastAPI's first-class async + WS is cleaner.
  - Django Channels — overkill, ORM unused.
- **Consequences:** Async-first code. Type-checked schemas. Easy migration to ASGI multi-worker in Phase 2.

## ADR-0003 — Communication protocol: WebSocket from day 1

- **Status:** Accepted
- **Context:** Phase 1 only needs human↔server, but Phase 2 needs server-pushed events to multiple humans per room. Two viable paths: REST + polling now, swap to WS later; or WS from day 1.
- **Decision:** WebSocket from day 1. `POST /api/games` creates a game; everything after that flows over `WS /ws/games/{id}`.
- **Rationale:**
  - Bot "thinking" delay is naturally event-driven (server pushes `bot_thinking` then `action`).
  - No polling loop in the client; cleaner Zustand reducer.
  - Phase 2 needs WS anyway; building it once is cheaper.
- **Consequences:** Slightly more setup than REST. Reconnect logic (snapshot fetch on connect) lives in the client from day 1, which actually helps Phase 1 page-reload UX.

## ADR-0004 — In-memory state behind a `GameStore` protocol

- **Status:** Accepted
- **Context:** Phase 1 doesn't need persistence; Phase 2 needs Redis-backed shared state if we ever run >1 process.
- **Decision:** Define `GameStore` protocol with `get / set / delete / iter_games`. Implement `InMemoryStore` for Phase 1. Redis impl is a single file in Phase 2.
- **Alternatives considered:**
  - Direct `Dict[game_id, GameState]` — fastest now, but the swap-in cost is non-trivial because call sites touch the dict directly. Protocol is cheap insurance.
  - Redis from day 1 — adds infra (Docker compose) for no Phase 1 benefit.
- **Consequences:** Tiny abstraction layer. Tests can use the in-memory impl directly.

## ADR-0005 — Bot AI: hybrid (heuristics + MCTS-lite on high-stakes branches)

- **Status:** Accepted
- **Context:** Bots should beat casual humans and challenge experienced ones, while staying strictly fair (no peeking). 1–2s think delay is required for UX; that's enough budget for real search.
- **Decision:** Weighted heuristic scorer as the default. MCTS-lite (determinized rollouts) overlays on high-stakes branches (winning move possible, treatments, close top-2). ~1s compute budget per decision.
- **Alternatives considered:**
  - Heuristics only — strong vs casuals, plateaus against learners.
  - Full information-set MCTS — significantly more implementation cost; overkill for Phase 1.
  - RL via self-play — months of training; not justified.
- **Consequences:** Two policies to maintain (heuristic + rollout). Heuristic doubles as the rollout policy, reducing surface area. Fairness enforced by snapshot-only input + a unit test.

## ADR-0006 — Snapshot as the single wire shape; bots see the same shape

- **Status:** Accepted
- **Context:** Hidden information must be hidden uniformly from humans and bots. Mistakes here have shipped silently in toy implementations.
- **Decision:** `public_snapshot(state, viewer_idx)` is the only function that exits the engine. Other players' hand contents are replaced with `hand_count: int`. Bots receive the snapshot for *their* seat — never the full `GameState`.
- **Consequences:** One serialization path to audit. Easy to test ("bot fed a tampered snapshot raises"). Engine stays mutation-only; snapshot is read-only.

## ADR-0007 — `rules.py` as the sole mutation site for organs and hands

- **Status:** Accepted
- **Context:** Rule logic scattered across modules is the #1 source of bugs in card-game engines.
- **Decision:** `game.py` orchestrates turns but never touches `Player.body` or `Player.hand` directly; all mutations flow through `rules.apply_play`. `Organ.status` is a computed property, never assigned.
- **Consequences:** Rules are concentrated in one auditable file. New cards are added by extending `apply_play` + `legal_targets` in one place.

## ADR-0008 — Procedural SVG card rendering (no PNG card assets in Phase 1)

- **Status:** Accepted
- **Context:** "Card and deck visibility is a top priority" + theme toggle + state overlays (infected/immunized) need to re-skin live without re-encoding 60+ images.
- **Decision:** Render card faces as styled SVG built from a small set of pictograms. Theme tokens (CSS custom properties) drive colors. Backs use a single SVG with the wordmark.
- **Alternatives considered:**
  - PNG assets — requires illustration work and locks in theming.
- **Consequences:** Slightly more frontend code. Trivial to skin and animate. Custom decks/themes possible later by swapping pictograms.

## ADR-0009 — `run.sh` defaults to production mode on `:8001`; `dev` flag for HMR

- **Status:** Accepted
- **Context:** User asked for one-command boot on port 8001. Need to also support dev iteration with Vite HMR.
- **Decision:** `./run.sh` (no args) builds frontend if needed and serves built assets via FastAPI on `:8001`. `./run.sh dev` runs uvicorn + Vite together, Vite at `:5173` proxies `/api` + `/ws` to `:8001`.
- **Consequences:** Single URL/port for "just run it." Dev mode is opt-in but obvious. `./run.sh clean` resets caches.

## ADR-0010 — Documentation lives flat under `docs/specs/`

- **Status:** Accepted
- **Context:** User preference: spec / decisions / tasks should live as files under one folder, not separate folders.
- **Decision:** `docs/specs/spec.md`, `docs/specs/decisions.md`, `docs/specs/tasks.md`. Changelog at `docs/changelog.md`.
- **Consequences:** Brainstorming-skill default path (`docs/superpowers/specs/...`) is overridden by explicit user preference, which is the correct precedence.
