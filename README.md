---
title: Antibody Politics
emoji: 🧬
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Antibody Politics

A digital implementation of the Spanish card game **Virus!** — play 1 human vs 3 bots, or invite friends for an online multiplayer match. Built with FastAPI on the backend, React + Vite on the frontend, and a WebSocket-first protocol for low-latency turn updates.

🎮 **Play it now:** https://masudurHimel-antibody-politics.hf.space

---

## How to play

Each player has a body of four organs (heart, brain, stomach, bone). The goal is to be the first to get all four of your organs into a **healthy** or **immunized** state.

- **Organ** — place into your body.
- **Virus** — infect an opponent's organ. Two viruses on the same organ destroy it.
- **Medicine** — heal one of your own organs. Two medicines immunize it permanently.
- **Treatment** — special action cards (transplant, organ thief, contagion, latex glove, medical error).

On your turn you may **play one card**, **discard 1–3 cards**, or **pass**. Then you draw back up to 3 cards. First player to four healthy/immunized organs wins.

### Game modes

- **Solo** — you vs 3 bots with adaptive difficulty (weighted heuristics + MCTS-lite on high-stakes decisions).
- **Multiplayer** — create a room, share the invite link, and play with up to 3 friends. Empty seats are filled with bots.

---

## Quick start (local)

```bash
./run.sh
# open http://127.0.0.1:8001
```

For development with hot reload:

```bash
./run.sh dev
# uvicorn (reload) on :8001, Vite (HMR) on :5173
```

To wipe build artifacts:

```bash
./run.sh clean
```

### Requirements

- Python 3.11
- Node.js 20+
- npm

The `run.sh` script handles the venv, frontend deps, and the production build automatically — first launch will take a minute, subsequent launches are instant.

---

## Play with friends locally (ngrok)

If you'd rather host the game from your own machine instead of using the hosted Space:

```bash
./run.sh                # terminal 1
./scripts/tunnel.sh     # terminal 2
```

Share the `https://*.ngrok-free.app` URL. Friends open the link, the host taps **MULTIPLAYER → CREATE**, then shares the lobby invite (`/join/<room-id>`). Each player picks a name and taps **READY**; the host taps **START** when ready.

---

## Architecture

Single FastAPI process. WebSocket-first communication. All state in memory behind a `GameStore` protocol so Phase 2 can swap to Redis without touching the engine.

### Backend layers (`backend/app/`)

Each layer can be imported without the one above it.

| Layer | Responsibility |
|---|---|
| `models.py` | Pydantic models, enums, computed organ status |
| `deck.py` | Canonical 68-card deck + reshuffle-on-empty |
| `rules.py` | **The rule book** — pure functions, sole mutation site for organs and hands |
| `game.py` | Turn loop: play → draw → advance |
| `snapshot.py` | `public_snapshot(state, viewer_idx)` — the only shape that leaves the engine |
| `store.py` | `GameStore` protocol + `InMemoryStore` |
| `bot.py` | Bot policy — receives **snapshot only**, never full state |
| `ws.py` | WebSocket gateway, event router, bot turn driver |
| `main.py` | FastAPI app, HTTP routes, static mount in prod mode |

### Frontend (`frontend/src/`)

- `game/` — Zustand store, WebSocket client (auto-reconnect), TS types
- `cards/` — Procedural SVG card renderer (no PNG assets)
- `components/` — `Hand`, `OrganRow`, `BoardSeat`, `ActivityLog`, etc.
- `anim/` — Framer Motion shared variants
- `pages/` — `Game.tsx`, `NewGame.tsx`
- `styles/index.css` — Tailwind + theme tokens

### Invariants

- `rules.py` is the only place that mutates organs/hands.
- `Organ.status` is computed, never assigned.
- `public_snapshot` is the only shape leaving the server.
- Bots and humans see the same snapshot shape — fairness asserted in tests.
- No optimistic updates on the client; the server is authoritative.

---

## Tests

```bash
# Backend
cd backend && ./venv/bin/pytest

# Frontend
cd frontend && npm test

# Bot tournament (4-bot self-play, regression check)
./venv/bin/pytest tests/test_bot.py -k tournament -v
```

---

## Deployment

The hosted version runs on **Hugging Face Spaces** via a multi-stage `Dockerfile` (Node builds the frontend, Python serves it from FastAPI). Pushes to `master` on GitHub auto-deploy via the workflow at [`.github/workflows/sync-to-hf-space.yml`](.github/workflows/sync-to-hf-space.yml).

If the Space has been idle for a while, the first request may take ~10–20s to wake.

---

## Docs

- 📘 [Design spec](docs/specs/spec.md)
- 🏛 [Architectural decisions](docs/specs/decisions.md)
- 🗺 [Implementation plan](docs/specs/plan.md)
- ✅ [Task roadmap](docs/specs/tasks.md)
- 📰 [Changelog](docs/changelog.md)

---

## Tech stack

**Backend:** Python 3.11 · FastAPI · Pydantic v2 · uvicorn · WebSockets
**Frontend:** React 18 · Vite · TypeScript · Tailwind · Framer Motion · Zustand
**Infra:** Docker · Hugging Face Spaces · GitHub Actions

---

## Credits

Based on the card game **Virus!** by Tranjis Games. This is an unofficial fan implementation for educational and personal use.
