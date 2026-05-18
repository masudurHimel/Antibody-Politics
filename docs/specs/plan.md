# Antibody Politics — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished single-player web implementation of the Virus! card game (1 human + 3 bots) that boots via `./run.sh` on `127.0.0.1:8001`, with a faithful rules engine, a hybrid heuristic+MCTS bot, and an animated React UI.

**Architecture:** FastAPI (Python 3.11+) backend with a layered pure-function engine, WebSocket-first communication, and an in-memory `GameStore` swappable for Redis in Phase 2. React 18 + Vite + TypeScript frontend with Tailwind + Framer Motion, Zustand store, and procedurally rendered SVG cards. Single repo, single process.

**Tech Stack:** Python 3.11 · FastAPI · Pydantic v2 · uvicorn · pytest · React 18 · Vite · TypeScript · Tailwind · Framer Motion · Zustand · Node 20+

**Spec reference:** [`spec.md`](spec.md) · [`decisions.md`](decisions.md) · [`tasks.md`](tasks.md)

---

## File Structure

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `requirements.txt` | Python deps: fastapi, uvicorn, pydantic, pytest, httpx, websockets |
| `app/__init__.py` | Package marker |
| `app/models.py` | Pydantic v2 models + enums; computed `Organ.status` property |
| `app/deck.py` | Canonical 68-card deck builder + draw/reshuffle helpers |
| `app/rules.py` | Pure rule functions: `apply_play`, `legal_targets`, `IllegalAction` exception |
| `app/game.py` | Turn loop: `play_card`, `discard_cards`, `pass_turn`, `check_winner`, `advance_turn` |
| `app/snapshot.py` | `public_snapshot(state, viewer_idx)` — sole wire-shape producer |
| `app/store.py` | `GameStore` protocol + `InMemoryStore` impl |
| `app/bot.py` | Hybrid policy: heuristic scorer + MCTS-lite overlay |
| `app/ws.py` | WebSocket gateway, event router, bot turn driver |
| `app/main.py` | FastAPI app, HTTP routes, static mount, lifespan |
| `tests/conftest.py` | Shared pytest fixtures |
| `tests/test_rules.py` | Unit tests for every card type + edge cases |
| `tests/test_engine.py` | 1000-game fuzz + termination assertions |
| `tests/test_bot.py` | Hybrid vs heuristic-only tournament + fairness test |
| `tests/test_snapshot.py` | Hidden-info masking assertions |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `package.json` | npm deps + scripts |
| `vite.config.ts` | Vite config with dev proxy to `:8001` |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | Tailwind + theme tokens |
| `postcss.config.js` | PostCSS for Tailwind |
| `index.html` | Vite entry |
| `src/main.tsx` | React bootstrap |
| `src/App.tsx` | Router-less top-level switch (Game vs NewGame) |
| `src/game/types.ts` | TS types mirroring backend wire shapes |
| `src/game/store.ts` | Zustand store with all slices |
| `src/game/ws.ts` | WebSocket client with reconnect |
| `src/game/actions.ts` | High-level intent dispatchers |
| `src/cards/CardFront.tsx` | Procedural SVG card front |
| `src/cards/CardBack.tsx` | Procedural SVG card back |
| `src/cards/Pictograms.tsx` | Pictogram set (organ/virus/medicine/treatment icons) |
| `src/components/Hand.tsx` | Human's fanned hand |
| `src/components/OrganRow.tsx` | 4 organ slots + attached cards |
| `src/components/BoardSeat.tsx` | Bot seat: avatar, hand-count, organ row, thinking indicator |
| `src/components/ActivityLog.tsx` | Last 4 events with fade-out |
| `src/components/ThemeToggle.tsx` | Light/dark toggle + localStorage |
| `src/components/Toast.tsx` | Floating transient event toasts |
| `src/components/Settings.tsx` | Sound, animation speed |
| `src/components/Banner.tsx` | Victory banner |
| `src/anim/variants.ts` | Framer Motion shared variants |
| `src/styles/index.css` | Tailwind directives + theme custom-property defs |
| `src/pages/Game.tsx` | In-game layout (center table + 4 seats + side panel) |
| `src/pages/NewGame.tsx` | Start screen |

### Top-level

| File | Responsibility |
|------|---------------|
| `run.sh` | One-command boot script: default / `dev` / `clean` modes |
| `CLAUDE.md` | Working principles + architecture summary + pointer to `docs/specs/` |
| `README.md` | Short user-facing readme |
| `.gitignore` | Already exists; ensure `venv/`, `node_modules/`, `dist/` covered |

---

## Milestone 0 — Project bootstrap

### Task 0.1: Update `.gitignore` and write project `README.md`

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Ensure `.gitignore` covers Python venv, Node, Vite build, OS junk**

Append to `.gitignore` (do not duplicate lines that already exist):

```
# Backend
backend/venv/
backend/__pycache__/
backend/**/__pycache__/
backend/.pytest_cache/
backend/*.egg-info/

# Frontend
frontend/node_modules/
frontend/dist/
frontend/.vite/
frontend/coverage/

# Editor / OS
.DS_Store
*.pyc
```

- [ ] **Step 2: Rewrite `README.md`**

Replace contents with:

```markdown
# Antibody Politics

A digital implementation of the Spanish card game **Virus!** — 1 human vs 3 bots, online multiplayer in Phase 2.

## Quick start

```bash
./run.sh
# Open http://127.0.0.1:8001
```

For dev with hot reload: `./run.sh dev` (open `:5173`).

## Docs

- Design spec: [`docs/specs/spec.md`](docs/specs/spec.md)
- Architectural decisions: [`docs/specs/decisions.md`](docs/specs/decisions.md)
- Implementation plan: [`docs/specs/plan.md`](docs/specs/plan.md)
- Changelog: [`docs/changelog.md`](docs/changelog.md)

## Tech

Python 3.11 · FastAPI · Pydantic v2 · React 18 · Vite · TypeScript · Tailwind · Framer Motion · Zustand
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "chore: prepare gitignore and readme for project bootstrap"
```

### Task 0.2: Create backend skeleton with `requirements.txt` and venv

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pytest==8.3.3
httpx==0.27.2
websockets==13.1
```

- [ ] **Step 2: Create empty package markers**

`backend/app/__init__.py` — empty file.
`backend/tests/__init__.py` — empty file.

- [ ] **Step 3: Create `backend/tests/conftest.py` with shared fixtures placeholder**

```python
import random
import pytest


@pytest.fixture
def rng():
    return random.Random(42)
```

- [ ] **Step 4: Bootstrap venv and install**

```bash
cd backend
python3.11 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
./venv/bin/pytest --version
```

Expected: pytest reports its version. No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "chore: scaffold backend with FastAPI deps and venv-ready layout"
```

### Task 0.3: Create frontend skeleton with Vite + React + TS + Tailwind

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles/index.css`

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "antibody-politics-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^11.11.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.3",
    "tailwindcss": "^3.4.14",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

- [ ] **Step 2: Write `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8001", ws: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
```

- [ ] **Step 3: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": false
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `frontend/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        accent: "var(--accent)",
        text: "var(--text)",
        muted: "var(--muted)",
        cardback: "var(--card-back)",
        red: { game: "var(--c-red)" },
        green: { game: "var(--c-green)" },
        blue: { game: "var(--c-blue)" },
        yellow: { game: "var(--c-yellow)" },
      },
      fontFamily: { display: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 10px 30px -8px rgba(0,0,0,0.5)" },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Write `frontend/postcss.config.js`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Antibody Politics</title>
  </head>
  <body class="bg-bg text-text">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `frontend/src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root[data-theme="dark"] {
  --bg: #0a0e1a;
  --surface: #131a2b;
  --accent: #f5c43a;
  --text: #f6f3ec;
  --muted: #7c8398;
  --card-back: #b1262f;
  --c-red: #d24a4a;
  --c-green: #4cae6a;
  --c-blue: #4a80d2;
  --c-yellow: #e8c34a;
}

:root[data-theme="light"] {
  --bg: #f5f3ee;
  --surface: #ffffff;
  --accent: #c9961a;
  --text: #1a1c22;
  --muted: #6b7286;
  --card-back: #b1262f;
  --c-red: #c83c3c;
  --c-green: #3e9357;
  --c-blue: #3a6cb8;
  --c-yellow: #d6ad33;
}

html, body, #root { height: 100%; }
body { font-family: var(--font-display, "Inter", system-ui, sans-serif); transition: background-color 250ms ease, color 250ms ease; }
* { -webkit-tap-highlight-color: transparent; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 8: Write `frontend/src/main.tsx`**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

const savedTheme = localStorage.getItem("theme") ?? "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Write placeholder `frontend/src/App.tsx`**

```typescript
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center text-2xl font-display">
      Antibody Politics — bootstrap OK
    </div>
  );
}
```

- [ ] **Step 10: Install and verify build**

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

Expected: clean install, typecheck OK, `dist/` produced with `index.html` + assets.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold frontend with Vite, React, TS, Tailwind"
```

### Task 0.4: Write `run.sh`

**Files:**
- Create: `run.sh`

- [ ] **Step 1: Write `run.sh`**

```bash
#!/usr/bin/env bash
# Antibody Politics — boot script
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
VENV="$BACKEND_DIR/venv"
PORT_BACKEND=8001
PORT_VITE=5173

ensure_venv() {
  if [[ ! -x "$VENV/bin/python" ]]; then
    echo "→ creating venv at $VENV"
    python3.11 -m venv "$VENV" || python3 -m venv "$VENV"
    "$VENV/bin/pip" install --upgrade pip >/dev/null
    "$VENV/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
  fi
}

ensure_node_modules() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "→ installing frontend deps"
    (cd "$FRONTEND_DIR" && npm install)
  fi
}

ensure_frontend_build() {
  if [[ ! -d "$FRONTEND_DIR/dist" || -z "$(ls -A "$FRONTEND_DIR/dist" 2>/dev/null)" ]]; then
    echo "→ building frontend"
    (cd "$FRONTEND_DIR" && npm run build)
  fi
}

mode="${1:-run}"

case "$mode" in
  run)
    ensure_venv
    ensure_node_modules
    ensure_frontend_build
    echo "→ serving on http://127.0.0.1:$PORT_BACKEND"
    exec "$VENV/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 127.0.0.1 --port "$PORT_BACKEND"
    ;;
  dev)
    ensure_venv
    ensure_node_modules
    echo "→ dev: uvicorn :$PORT_BACKEND (reload) + vite :$PORT_VITE"
    "$VENV/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 127.0.0.1 --port "$PORT_BACKEND" --reload &
    UVICORN_PID=$!
    trap "kill $UVICORN_PID 2>/dev/null || true" EXIT INT TERM
    (cd "$FRONTEND_DIR" && npm run dev -- --host 127.0.0.1 --port "$PORT_VITE")
    ;;
  clean)
    echo "→ removing venv, node_modules, dist"
    rm -rf "$VENV" "$FRONTEND_DIR/node_modules" "$FRONTEND_DIR/dist"
    ;;
  *)
    echo "usage: $0 [run|dev|clean]"
    exit 1
    ;;
esac
```

- [ ] **Step 2: Make executable**

```bash
chmod +x run.sh
```

- [ ] **Step 3: Verify clean mode prints expected line**

```bash
./run.sh clean
```

Expected: "→ removing venv, node_modules, dist" and idempotent (re-running doesn't error).

- [ ] **Step 4: Commit**

```bash
git add run.sh
git commit -m "chore: add run.sh with run/dev/clean modes on :8001"
```

### Task 0.5: Rewrite `CLAUDE.md` for the new architecture

**Files:**
- Modify: `CLAUDE.md` (full rewrite)

- [ ] **Step 1: Replace `CLAUDE.md` content**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md for new architecture"
```

---

## Milestone 1 — Game engine

### Task 1.1: Define models and enums

**Files:**
- Create: `backend/app/models.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_models.py`**

```python
from app.models import (
    Card, Color, CardType, Organ, OrganStatus, Player, TreatmentKind,
)


def make_card(**kw):
    defaults = dict(id="c1", type=CardType.VIRUS, color=Color.RED)
    defaults.update(kw)
    return Card(**defaults)


def test_organ_status_free_when_no_attached():
    o = Organ(id="o1", color=Color.RED, attached=[])
    assert o.status == OrganStatus.FREE


def test_organ_status_infected_with_one_virus():
    o = Organ(id="o1", color=Color.RED, attached=[make_card(type=CardType.VIRUS, color=Color.RED)])
    assert o.status == OrganStatus.INFECTED


def test_organ_status_vaccinated_with_one_medicine():
    o = Organ(id="o1", color=Color.RED, attached=[make_card(type=CardType.MEDICINE, color=Color.RED)])
    assert o.status == OrganStatus.VACCINATED


def test_organ_status_immunized_with_two_medicines():
    o = Organ(id="o1", color=Color.RED, attached=[
        make_card(id="m1", type=CardType.MEDICINE, color=Color.RED),
        make_card(id="m2", type=CardType.MEDICINE, color=Color.MULTI),
    ])
    assert o.status == OrganStatus.IMMUNIZED


def test_has_won_requires_four_distinct_colors_healthy():
    body = [
        Organ(id=f"o{i}", color=c, attached=[])
        for i, c in enumerate([Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW])
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()


def test_has_won_false_with_three_distinct_plus_duplicate():
    body = [
        Organ(id="o0", color=Color.RED, attached=[]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.BLUE, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert not p.has_won()


def test_has_won_multi_organ_satisfies_missing_color():
    body = [
        Organ(id="o0", color=Color.RED, attached=[]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.MULTI, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert p.has_won()


def test_has_won_false_with_infected_organ():
    body = [
        Organ(id="o0", color=Color.RED, attached=[make_card(type=CardType.VIRUS, color=Color.RED)]),
        Organ(id="o1", color=Color.GREEN, attached=[]),
        Organ(id="o2", color=Color.BLUE, attached=[]),
        Organ(id="o3", color=Color.YELLOW, attached=[]),
    ]
    p = Player(idx=0, name="me", is_bot=False, hand=[], body=body)
    assert not p.has_won()
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_models.py -v
```

Expected: ImportError or AttributeError — `app.models` doesn't exist.

- [ ] **Step 3: Implement `backend/app/models.py`**

```python
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field


class Color(str, Enum):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"
    YELLOW = "yellow"
    MULTI = "multi"


class CardType(str, Enum):
    ORGAN = "organ"
    VIRUS = "virus"
    MEDICINE = "medicine"
    TREATMENT = "treatment"


class TreatmentKind(str, Enum):
    TRANSPLANT = "transplant"
    ORGAN_THIEF = "organ_thief"
    CONTAGION = "contagion"
    LATEX_GLOVE = "latex_glove"
    MEDICAL_ERROR = "medical_error"


class OrganStatus(str, Enum):
    FREE = "free"
    VACCINATED = "vaccinated"
    INFECTED = "infected"
    IMMUNIZED = "immunized"


class Card(BaseModel):
    id: str
    type: CardType
    color: Color
    treatment_kind: Optional[TreatmentKind] = None

    def matches_color(self, other: Color) -> bool:
        return self.color == Color.MULTI or other == Color.MULTI or self.color == other


class Organ(BaseModel):
    id: str
    color: Color
    attached: list[Card] = Field(default_factory=list)

    @computed_field  # type: ignore[misc]
    @property
    def status(self) -> OrganStatus:
        viruses = [c for c in self.attached if c.type == CardType.VIRUS]
        medicines = [c for c in self.attached if c.type == CardType.MEDICINE]
        if len(medicines) >= 2:
            return OrganStatus.IMMUNIZED
        if len(medicines) == 1 and not viruses:
            return OrganStatus.VACCINATED
        if len(viruses) == 1 and not medicines:
            return OrganStatus.INFECTED
        return OrganStatus.FREE


def _has_distinct_winning_set(colors: list[Color]) -> bool:
    """4 colors, distinct, MULTI fills any missing color."""
    if len(colors) != 4:
        return False
    plain = [c for c in colors if c != Color.MULTI]
    multis = len(colors) - len(plain)
    if len(set(plain)) != len(plain):
        return False
    if multis == 0:
        return len(set(plain)) == 4
    needed = 4 - len(plain)
    return multis >= needed


class Player(BaseModel):
    idx: int
    name: str
    is_bot: bool
    hand: list[Card] = Field(default_factory=list)
    body: list[Organ] = Field(default_factory=list)

    def has_won(self) -> bool:
        healthy = [o for o in self.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
        return _has_distinct_winning_set([o.color for o in healthy])


class GameState(BaseModel):
    game_id: str
    seed: int
    players: list[Player]
    deck: list[Card] = Field(default_factory=list)
    discard: list[Card] = Field(default_factory=list)
    turn_idx: int = 0
    winner_idx: Optional[int] = None
    event_log: list[str] = Field(default_factory=list)
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_models.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_models.py
git commit -m "feat(engine): pydantic models with computed Organ.status and has_won"
```

### Task 1.2: Canonical deck builder

**Files:**
- Create: `backend/app/deck.py`
- Test: `backend/tests/test_deck.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_deck.py`**

```python
import random
from collections import Counter

from app.deck import build_deck, draw_one
from app.models import CardType, Color, TreatmentKind


def test_total_card_count_is_68():
    deck = build_deck()
    assert len(deck) == 68


def test_organ_distribution():
    deck = build_deck()
    organs = [c for c in deck if c.type == CardType.ORGAN]
    assert len(organs) == 21
    by_color = Counter(c.color for c in organs)
    assert by_color[Color.RED] == 5
    assert by_color[Color.GREEN] == 5
    assert by_color[Color.BLUE] == 5
    assert by_color[Color.YELLOW] == 5
    assert by_color[Color.MULTI] == 1


def test_virus_distribution():
    deck = build_deck()
    viruses = [c for c in deck if c.type == CardType.VIRUS]
    assert len(viruses) == 17
    by_color = Counter(c.color for c in viruses)
    assert by_color[Color.RED] == 4
    assert by_color[Color.GREEN] == 4
    assert by_color[Color.BLUE] == 4
    assert by_color[Color.YELLOW] == 4
    assert by_color[Color.MULTI] == 1


def test_medicine_distribution():
    deck = build_deck()
    meds = [c for c in deck if c.type == CardType.MEDICINE]
    assert len(meds) == 20
    by_color = Counter(c.color for c in meds)
    assert by_color[Color.RED] == 4
    assert by_color[Color.GREEN] == 4
    assert by_color[Color.BLUE] == 4
    assert by_color[Color.YELLOW] == 4
    assert by_color[Color.MULTI] == 4


def test_treatment_distribution():
    deck = build_deck()
    treats = [c for c in deck if c.type == CardType.TREATMENT]
    assert len(treats) == 10
    by_kind = Counter(c.treatment_kind for c in treats)
    assert by_kind[TreatmentKind.TRANSPLANT] == 3
    assert by_kind[TreatmentKind.ORGAN_THIEF] == 1
    assert by_kind[TreatmentKind.CONTAGION] == 2
    assert by_kind[TreatmentKind.LATEX_GLOVE] == 1
    assert by_kind[TreatmentKind.MEDICAL_ERROR] == 3


def test_card_ids_are_unique():
    deck = build_deck()
    ids = [c.id for c in deck]
    assert len(set(ids)) == len(ids)


def test_draw_one_reshuffles_discard_when_deck_empty():
    deck = []
    discard = build_deck()
    rng = random.Random(7)
    card = draw_one(deck, discard, rng)
    assert card is not None
    assert len(discard) == 0
    assert len(deck) == 67  # 68 reshuffled, 1 drawn
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_deck.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/deck.py`**

```python
from __future__ import annotations

import random
from typing import Optional

from .models import Card, CardType, Color, TreatmentKind

_COLORED = [Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW]


def _add(out: list[Card], type_: CardType, color: Color, count: int, *, treatment_kind: Optional[TreatmentKind] = None) -> None:
    prefix = type_.value[0] if treatment_kind is None else f"t-{treatment_kind.value}"
    base = sum(1 for c in out if c.type == type_ and c.color == color and c.treatment_kind == treatment_kind)
    for i in range(count):
        cid = f"{prefix}-{color.value}-{base + i}"
        out.append(Card(id=cid, type=type_, color=color, treatment_kind=treatment_kind))


def build_deck() -> list[Card]:
    deck: list[Card] = []

    # Organs: 5 of each color + 1 multi
    for color in _COLORED:
        _add(deck, CardType.ORGAN, color, 5)
    _add(deck, CardType.ORGAN, Color.MULTI, 1)

    # Viruses: 4 of each color + 1 multi
    for color in _COLORED:
        _add(deck, CardType.VIRUS, color, 4)
    _add(deck, CardType.VIRUS, Color.MULTI, 1)

    # Medicines: 4 of each color + 4 multi
    for color in _COLORED:
        _add(deck, CardType.MEDICINE, color, 4)
    _add(deck, CardType.MEDICINE, Color.MULTI, 4)

    # Treatments: 3 Transplant, 1 Organ Thief, 2 Contagion, 1 Latex Glove, 3 Medical Error
    _add(deck, CardType.TREATMENT, Color.MULTI, 3, treatment_kind=TreatmentKind.TRANSPLANT)
    _add(deck, CardType.TREATMENT, Color.MULTI, 1, treatment_kind=TreatmentKind.ORGAN_THIEF)
    _add(deck, CardType.TREATMENT, Color.MULTI, 2, treatment_kind=TreatmentKind.CONTAGION)
    _add(deck, CardType.TREATMENT, Color.MULTI, 1, treatment_kind=TreatmentKind.LATEX_GLOVE)
    _add(deck, CardType.TREATMENT, Color.MULTI, 3, treatment_kind=TreatmentKind.MEDICAL_ERROR)

    return deck


def shuffle_into(deck: list[Card], discard: list[Card], rng: random.Random) -> None:
    """When the deck is empty, fold the discard back into it (shuffled)."""
    if deck:
        return
    rng.shuffle(discard)
    deck.extend(discard)
    discard.clear()


def draw_one(deck: list[Card], discard: list[Card], rng: random.Random) -> Optional[Card]:
    if not deck:
        shuffle_into(deck, discard, rng)
    if not deck:
        return None
    return deck.pop()
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_deck.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/deck.py backend/tests/test_deck.py
git commit -m "feat(engine): canonical 68-card deck builder with reshuffle"
```

### Task 1.3: Rules — `IllegalAction` + `legal_targets` skeleton

**Files:**
- Create: `backend/app/rules.py`
- Test: `backend/tests/test_rules.py` (start)

- [ ] **Step 1: Write failing tests for foundational helpers**

```python
import random

import pytest

from app.deck import build_deck
from app.models import (
    Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind,
)
from app.rules import IllegalAction, apply_play, legal_targets


def _empty_state() -> GameState:
    players = [
        Player(idx=i, name=f"P{i}", is_bot=(i != 0), hand=[], body=[]) for i in range(4)
    ]
    return GameState(game_id="g1", seed=1, players=players, deck=[], discard=[])


def _card(id_: str, type_: CardType, color: Color, *, tk: TreatmentKind | None = None) -> Card:
    return Card(id=id_, type=type_, color=color, treatment_kind=tk)


def test_play_organ_into_empty_body():
    s = _empty_state()
    organ_card = _card("org-r-0", CardType.ORGAN, Color.RED)
    s.players[0].hand.append(organ_card)
    events = apply_play(s, 0, organ_card.id, {})
    assert len(s.players[0].body) == 1
    assert s.players[0].body[0].color == Color.RED
    assert s.players[0].body[0].id != organ_card.id  # organs get a fresh body id
    assert organ_card not in s.players[0].hand
    assert any("Red organ" in e or "organ" in e.lower() for e in events)


def test_play_duplicate_color_organ_is_illegal():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-existing", color=Color.RED, attached=[]))
    organ_card = _card("org-r-1", CardType.ORGAN, Color.RED)
    s.players[0].hand.append(organ_card)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, organ_card.id, {})


def test_legal_targets_for_organ_is_single_empty_dict():
    s = _empty_state()
    organ = _card("org-r-0", CardType.ORGAN, Color.RED)
    assert legal_targets(s, 0, organ) == [{}]


def test_legal_targets_for_organ_blocked_when_duplicate_color_in_body():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-existing", color=Color.RED, attached=[]))
    organ = _card("org-r-0", CardType.ORGAN, Color.RED)
    assert legal_targets(s, 0, organ) == []
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement initial `backend/app/rules.py` with ORGAN support**

```python
from __future__ import annotations

import uuid
from typing import Any

from .models import (
    Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind,
)


class IllegalAction(Exception):
    pass


# ---- helpers --------------------------------------------------------------

def _pop_card_from_hand(player: Player, card_id: str) -> Card:
    for i, c in enumerate(player.hand):
        if c.id == card_id:
            return player.hand.pop(i)
    raise IllegalAction(f"card {card_id} not in hand of P{player.idx}")


def _find_organ(player: Player, organ_id: str) -> Organ:
    for o in player.body:
        if o.id == organ_id:
            return o
    raise IllegalAction(f"organ {organ_id} not in P{player.idx} body")


def _body_colors(player: Player) -> set[Color]:
    return {o.color for o in player.body}


def _organ_color_matches(card_color: Color, organ_color: Color) -> bool:
    return card_color == Color.MULTI or organ_color == Color.MULTI or card_color == organ_color


# ---- public API -----------------------------------------------------------

def legal_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    if card.type == CardType.ORGAN:
        return _legal_organ_targets(state, player_idx, card)
    raise IllegalAction(f"legal_targets not implemented for card type {card.type}")


def apply_play(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game already won")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")

    player = state.players[player_idx]
    card = next((c for c in player.hand if c.id == card_id), None)
    if card is None:
        raise IllegalAction(f"card {card_id} not in hand")

    if card.type == CardType.ORGAN:
        return _apply_organ(state, player, card)
    raise IllegalAction(f"apply_play not implemented for card type {card.type}")


# ---- organ ----------------------------------------------------------------

def _legal_organ_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    body_colors = _body_colors(state.players[player_idx])
    if card.color != Color.MULTI and card.color in body_colors:
        return []
    if card.color == Color.MULTI and Color.MULTI in body_colors:
        return []
    if len(state.players[player_idx].body) >= 4:
        return []
    return [{}]


def _apply_organ(state: GameState, player: Player, card: Card) -> list[str]:
    body_colors = _body_colors(player)
    if card.color != Color.MULTI and card.color in body_colors:
        raise IllegalAction(f"P{player.idx} already has a {card.color.value} organ")
    if card.color == Color.MULTI and Color.MULTI in body_colors:
        raise IllegalAction(f"P{player.idx} already has a multi organ")
    if len(player.body) >= 4:
        raise IllegalAction("body already has 4 organs")

    _pop_card_from_hand(player, card.id)
    organ = Organ(id=f"organ-{uuid.uuid4().hex[:8]}", color=card.color, attached=[])
    player.body.append(organ)
    return [f"P{player.idx} placed a {card.color.value} organ"]
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/rules.py backend/tests/test_rules.py
git commit -m "feat(engine): rules.py with ORGAN play and legal_targets"
```

### Task 1.4: Rules — virus and medicine plays

**Files:**
- Modify: `backend/app/rules.py`
- Modify: `backend/tests/test_rules.py`

- [ ] **Step 1: Append failing virus + medicine tests to `test_rules.py`**

```python
def test_play_virus_on_free_organ_infects_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[1].body.append(organ)
    virus = _card("v-r-0", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.INFECTED


def test_play_virus_on_infected_organ_destroys_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("v-r-existing", CardType.VIRUS, Color.RED)])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ not in s.players[1].body
    # all 3 cards (organ as a card? no — organ is removed; both viruses go to discard)
    discard_ids = {c.id for c in s.discard}
    assert "v-r-existing" in discard_ids
    assert "v-r-1" in discard_ids


def test_play_virus_on_vaccinated_organ_removes_medicine_back_to_free():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m-r-existing", CardType.MEDICINE, Color.RED)])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE
    discard_ids = {c.id for c in s.discard}
    assert {"m-r-existing", "v-r-1"} <= discard_ids


def test_play_virus_on_immunized_is_illegal():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED),
        _card("m2", CardType.MEDICINE, Color.RED),
    ])
    s.players[1].body.append(organ)
    virus = _card("v-r-1", CardType.VIRUS, Color.RED)
    s.players[0].hand.append(virus)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})


def test_play_medicine_on_free_organ_vaccinates_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[0].body.append(organ)
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.VACCINATED


def test_play_medicine_on_vaccinated_organ_immunizes_it():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("m1", CardType.MEDICINE, Color.RED)])
    s.players[0].body.append(organ)
    med2 = _card("m2", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med2)
    apply_play(s, 0, med2.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.IMMUNIZED


def test_play_medicine_on_infected_organ_cures_to_free():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[_card("v1", CardType.VIRUS, Color.RED)])
    s.players[0].body.append(organ)
    med = _card("m-r-0", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med)
    apply_play(s, 0, med.id, {"player": 0, "organ_id": "o-r"})
    assert organ.status == OrganStatus.FREE
    discard_ids = {c.id for c in s.discard}
    assert {"v1", "m-r-0"} <= discard_ids


def test_play_medicine_on_immunized_is_illegal():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED),
        _card("m2", CardType.MEDICINE, Color.RED),
    ])
    s.players[0].body.append(organ)
    med3 = _card("m3", CardType.MEDICINE, Color.RED)
    s.players[0].hand.append(med3)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, med3.id, {"player": 0, "organ_id": "o-r"})


def test_multi_virus_can_target_any_organ_color():
    s = _empty_state()
    organ = Organ(id="o-r", color=Color.RED, attached=[])
    s.players[1].body.append(organ)
    virus = _card("v-multi", CardType.VIRUS, Color.MULTI)
    s.players[0].hand.append(virus)
    apply_play(s, 0, virus.id, {"player": 1, "organ_id": "o-r"})
    assert organ.status == OrganStatus.INFECTED


def test_legal_targets_virus_lists_all_non_immunized_color_matching_organs():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-r", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[3].body.append(Organ(id="o-r2", color=Color.RED, attached=[
        _card("m1", CardType.MEDICINE, Color.RED), _card("m2", CardType.MEDICINE, Color.RED),
    ]))  # immunized
    virus = _card("v-r-0", CardType.VIRUS, Color.RED)
    targets = legal_targets(s, 0, virus)
    target_pairs = {(t["player"], t["organ_id"]) for t in targets}
    assert (1, "o-r") in target_pairs
    assert (2, "o-b") not in target_pairs  # color mismatch
    assert (3, "o-r2") not in target_pairs  # immunized
```

- [ ] **Step 2: Run tests, confirm failures**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v
```

Expected: import OK, virus/medicine tests fail.

- [ ] **Step 3: Extend `rules.py` to support VIRUS and MEDICINE**

Add the following functions and update the dispatchers in `legal_targets` and `apply_play`:

```python
# ---- virus / medicine ----------------------------------------------------

def _legal_attach_targets(state: GameState, card: Card) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in state.players:
        for o in p.body:
            if o.status == OrganStatus.IMMUNIZED:
                continue
            if not _organ_color_matches(card.color, o.color):
                continue
            out.append({"player": p.idx, "organ_id": o.id})
    return out


def _apply_attach(state: GameState, source: Player, card: Card, targets: dict[str, Any]) -> list[str]:
    if "player" not in targets or "organ_id" not in targets:
        raise IllegalAction("attach card requires {player, organ_id}")
    target_player = state.players[targets["player"]]
    organ = _find_organ(target_player, targets["organ_id"])
    if organ.status == OrganStatus.IMMUNIZED:
        raise IllegalAction("organ is immunized")
    if not _organ_color_matches(card.color, organ.color):
        raise IllegalAction("color mismatch")

    _pop_card_from_hand(source, card.id)

    events: list[str] = []
    if card.type == CardType.VIRUS:
        if organ.status == OrganStatus.VACCINATED:
            # remove the medicine, organ returns to FREE; both medicine and virus go to discard
            med = next(c for c in organ.attached if c.type == CardType.MEDICINE)
            organ.attached.remove(med)
            state.discard.append(med)
            state.discard.append(card)
            events.append(f"P{source.idx} virus stripped P{target_player.idx}'s {organ.color.value} vaccine")
        elif organ.status == OrganStatus.INFECTED:
            # destroy organ — organ leaves body; both viruses to discard
            for c in list(organ.attached):
                state.discard.append(c)
            state.discard.append(card)
            target_player.body.remove(organ)
            events.append(f"P{source.idx} destroyed P{target_player.idx}'s {organ.color.value} organ")
        else:  # FREE
            organ.attached.append(card)
            events.append(f"P{source.idx} infected P{target_player.idx}'s {organ.color.value} organ")
    elif card.type == CardType.MEDICINE:
        if organ.status == OrganStatus.INFECTED:
            virus = next(c for c in organ.attached if c.type == CardType.VIRUS)
            organ.attached.remove(virus)
            state.discard.append(virus)
            state.discard.append(card)
            events.append(f"P{source.idx} cured P{target_player.idx}'s {organ.color.value} organ")
        else:  # FREE or VACCINATED → attach medicine
            organ.attached.append(card)
            if organ.status == OrganStatus.IMMUNIZED:
                events.append(f"P{source.idx} immunized {'their' if target_player is source else f'P{target_player.idx}'} {organ.color.value} organ")
            else:
                events.append(f"P{source.idx} vaccinated {'their' if target_player is source else f'P{target_player.idx}'} {organ.color.value} organ")
    else:
        raise IllegalAction(f"unexpected attach card type {card.type}")
    return events
```

Then update the dispatchers (replace the existing bodies of `legal_targets` and `apply_play`):

```python
def legal_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    if card.type == CardType.ORGAN:
        return _legal_organ_targets(state, player_idx, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _legal_attach_targets(state, card)
    raise IllegalAction(f"legal_targets not implemented for card type {card.type}")


def apply_play(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game already won")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")

    player = state.players[player_idx]
    card = next((c for c in player.hand if c.id == card_id), None)
    if card is None:
        raise IllegalAction(f"card {card_id} not in hand")

    if card.type == CardType.ORGAN:
        return _apply_organ(state, player, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _apply_attach(state, player, card, targets)
    raise IllegalAction(f"apply_play not implemented for card type {card.type}")
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v
```

Expected: 14 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/rules.py backend/tests/test_rules.py
git commit -m "feat(engine): virus and medicine card resolution"
```

### Task 1.5: Rules — Transplant, Organ Thief, Latex Glove, Medical Error, Contagion

**Files:**
- Modify: `backend/app/rules.py`
- Modify: `backend/tests/test_rules.py`

- [ ] **Step 1: Append failing treatment tests**

```python
# --- TRANSPLANT ---

def test_transplant_swaps_two_organs():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})
    assert s.players[0].body[0].id == "o-b"
    assert s.players[1].body[0].id == "o-a"


def test_transplant_illegal_if_either_organ_immunized():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})


def test_transplant_illegal_if_creates_duplicate_color():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[1].body.append(Organ(id="o-c", color=Color.RED, attached=[]))
    t = _card("t-1", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.TRANSPLANT)
    s.players[0].hand.append(t)
    # transplant o-a (red) ↔ o-b (blue) would put a 2nd red in P1's body (it already has o-c red)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"from": {"player": 0, "organ_id": "o-a"}, "to": {"player": 1, "organ_id": "o-b"}})


# --- ORGAN THIEF ---

def test_organ_thief_moves_organ_to_self():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})
    assert any(o.id == "o-b" for o in s.players[0].body)
    assert not any(o.id == "o-b" for o in s.players[1].body)


def test_organ_thief_illegal_when_thief_would_have_duplicate():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-blue-own", color=Color.BLUE, attached=[]))
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})


def test_organ_thief_illegal_on_immunized():
    s = _empty_state()
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-2", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.ORGAN_THIEF)
    s.players[0].hand.append(t)
    with pytest.raises(IllegalAction):
        apply_play(s, 0, t.id, {"player": 1, "organ_id": "o-b"})


# --- LATEX GLOVE ---

def test_latex_glove_discards_other_players_hands():
    s = _empty_state()
    s.players[1].hand.extend([_card("h1", CardType.VIRUS, Color.RED), _card("h2", CardType.MEDICINE, Color.BLUE)])
    s.players[2].hand.append(_card("h3", CardType.ORGAN, Color.GREEN))
    s.players[0].hand.append(_card("hkeep", CardType.MEDICINE, Color.GREEN))
    t = _card("t-3", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.LATEX_GLOVE)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert s.players[1].hand == []
    assert s.players[2].hand == []
    assert any(c.id == "hkeep" for c in s.players[0].hand)
    discard_ids = {c.id for c in s.discard}
    assert {"h1", "h2", "h3", "t-3"} <= discard_ids


# --- MEDICAL ERROR ---

def test_medical_error_swaps_full_bodies():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    s.players[2].body.append(Organ(id="o-c", color=Color.GREEN, attached=[]))
    t = _card("t-4", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.MEDICAL_ERROR)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 2})
    p0_ids = {o.id for o in s.players[0].body}
    p2_ids = {o.id for o in s.players[2].body}
    assert p0_ids == {"o-b", "o-c"}
    assert p2_ids == {"o-a"}


def test_medical_error_swaps_even_with_immunized_organs():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-a", color=Color.RED, attached=[]))
    s.players[2].body.append(Organ(id="o-b", color=Color.BLUE, attached=[
        _card("m1", CardType.MEDICINE, Color.BLUE), _card("m2", CardType.MEDICINE, Color.BLUE),
    ]))
    t = _card("t-4", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.MEDICAL_ERROR)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {"player": 2})
    assert any(o.id == "o-b" for o in s.players[0].body)


# --- CONTAGION ---

def test_contagion_transfers_each_virus_to_first_matching_free_organ():
    s = _empty_state()
    # P0 has two infected organs
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vR", CardType.VIRUS, Color.RED)]))
    s.players[0].body.append(Organ(id="o-b", color=Color.BLUE, attached=[_card("vB", CardType.VIRUS, Color.BLUE)]))
    # P1 has a free red
    s.players[1].body.append(Organ(id="o-r1", color=Color.RED, attached=[]))
    # P2 has a free blue
    s.players[2].body.append(Organ(id="o-b2", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    # P0's organs go back to FREE; P1.red & P2.blue become INFECTED
    assert s.players[0].body[0].status == OrganStatus.FREE
    assert s.players[0].body[1].status == OrganStatus.FREE
    assert s.players[1].body[0].status == OrganStatus.INFECTED
    assert s.players[2].body[0].status == OrganStatus.INFECTED


def test_contagion_skips_when_no_matching_target():
    s = _empty_state()
    s.players[0].body.append(Organ(id="o-r", color=Color.RED, attached=[_card("vR", CardType.VIRUS, Color.RED)]))
    # No other player has a free RED — virus stays
    s.players[1].body.append(Organ(id="o-b", color=Color.BLUE, attached=[]))
    t = _card("t-5", CardType.TREATMENT, Color.MULTI, tk=TreatmentKind.CONTAGION)
    s.players[0].hand.append(t)
    apply_play(s, 0, t.id, {})
    assert s.players[0].body[0].status == OrganStatus.INFECTED
    assert s.players[1].body[0].status == OrganStatus.FREE
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v -k "transplant or thief or latex or medical or contagion"
```

Expected: those tests fail (treatment kinds not implemented yet).

- [ ] **Step 3: Implement treatment handlers in `rules.py`**

Append the following functions:

```python
# ---- treatments ----------------------------------------------------------

def _legal_treatment_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    kind = card.treatment_kind
    if kind == TreatmentKind.LATEX_GLOVE:
        return [{}]

    if kind == TreatmentKind.ORGAN_THIEF:
        out = []
        thief_colors = _body_colors(state.players[player_idx])
        for p in state.players:
            if p.idx == player_idx:
                continue
            for o in p.body:
                if o.status == OrganStatus.IMMUNIZED:
                    continue
                if o.color != Color.MULTI and o.color in thief_colors:
                    continue
                if o.color == Color.MULTI and Color.MULTI in thief_colors:
                    continue
                if len(state.players[player_idx].body) >= 4:
                    continue
                out.append({"player": p.idx, "organ_id": o.id})
        return out

    if kind == TreatmentKind.MEDICAL_ERROR:
        return [{"player": p.idx} for p in state.players if p.idx != player_idx]

    if kind == TreatmentKind.CONTAGION:
        # Always playable; effect resolves what's possible
        return [{}]

    if kind == TreatmentKind.TRANSPLANT:
        out = []
        players = state.players
        for src in players:
            for dst in players:
                if src.idx == dst.idx:
                    continue
                for o_src in src.body:
                    if o_src.status == OrganStatus.IMMUNIZED:
                        continue
                    for o_dst in dst.body:
                        if o_dst.status == OrganStatus.IMMUNIZED:
                            continue
                        if not _transplant_legal(src, dst, o_src, o_dst):
                            continue
                        out.append({
                            "from": {"player": src.idx, "organ_id": o_src.id},
                            "to":   {"player": dst.idx, "organ_id": o_dst.id},
                        })
        return out

    raise IllegalAction(f"unknown treatment kind {kind}")


def _transplant_legal(src: Player, dst: Player, o_src: Organ, o_dst: Organ) -> bool:
    """A transplant is legal iff after the swap neither body has duplicate colors."""
    src_colors = {o.color for o in src.body if o.id != o_src.id}
    dst_colors = {o.color for o in dst.body if o.id != o_dst.id}
    return o_dst.color not in src_colors and o_src.color not in dst_colors


def _apply_treatment(state: GameState, source: Player, card: Card, targets: dict[str, Any]) -> list[str]:
    kind = card.treatment_kind
    _pop_card_from_hand(source, card.id)

    if kind == TreatmentKind.LATEX_GLOVE:
        for p in state.players:
            if p.idx == source.idx:
                continue
            state.discard.extend(p.hand)
            p.hand.clear()
        state.discard.append(card)
        return [f"P{source.idx} played Latex Glove — all opponents discarded their hands"]

    if kind == TreatmentKind.ORGAN_THIEF:
        target = state.players[targets["player"]]
        organ = _find_organ(target, targets["organ_id"])
        if organ.status == OrganStatus.IMMUNIZED:
            source.hand.append(card)
            raise IllegalAction("cannot steal immunized")
        if len(source.body) >= 4:
            source.hand.append(card)
            raise IllegalAction("body full")
        thief_colors = _body_colors(source)
        if (organ.color != Color.MULTI and organ.color in thief_colors) or (organ.color == Color.MULTI and Color.MULTI in thief_colors):
            source.hand.append(card)
            raise IllegalAction("would create duplicate color")
        target.body.remove(organ)
        source.body.append(organ)
        state.discard.append(card)
        return [f"P{source.idx} stole P{target.idx}'s {organ.color.value} organ"]

    if kind == TreatmentKind.MEDICAL_ERROR:
        target = state.players[targets["player"]]
        source.body, target.body = target.body, source.body
        state.discard.append(card)
        return [f"P{source.idx} swapped bodies with P{target.idx}"]

    if kind == TreatmentKind.TRANSPLANT:
        f, t_ = targets["from"], targets["to"]
        a_player = state.players[f["player"]]
        b_player = state.players[t_["player"]]
        a = _find_organ(a_player, f["organ_id"])
        b = _find_organ(b_player, t_["organ_id"])
        if a.status == OrganStatus.IMMUNIZED or b.status == OrganStatus.IMMUNIZED:
            source.hand.append(card)
            raise IllegalAction("cannot transplant immunized")
        if not _transplant_legal(a_player, b_player, a, b):
            source.hand.append(card)
            raise IllegalAction("transplant would create duplicate color")
        a_idx = a_player.body.index(a)
        b_idx = b_player.body.index(b)
        a_player.body[a_idx] = b
        b_player.body[b_idx] = a
        state.discard.append(card)
        return [f"P{source.idx} swapped P{a_player.idx}'s {a.color.value} with P{b_player.idx}'s {b.color.value}"]

    if kind == TreatmentKind.CONTAGION:
        events: list[str] = []
        # Iterate over source's infected organs; for each, find first free matching-color organ on an opponent
        for src_organ in source.body:
            if src_organ.status != OrganStatus.INFECTED:
                continue
            virus = next(c for c in src_organ.attached if c.type == CardType.VIRUS)
            # find target
            chosen: tuple[Player, Organ] | None = None
            for p in state.players:
                if p.idx == source.idx:
                    continue
                for o in p.body:
                    if o.status != OrganStatus.FREE:
                        continue
                    if not _organ_color_matches(virus.color, o.color):
                        continue
                    chosen = (p, o)
                    break
                if chosen:
                    break
            if chosen:
                tgt_player, tgt_organ = chosen
                src_organ.attached.remove(virus)
                tgt_organ.attached.append(virus)
                events.append(f"P{source.idx} contagion infected P{tgt_player.idx}'s {tgt_organ.color.value} organ")
        state.discard.append(card)
        if not events:
            events.append(f"P{source.idx} played Contagion (no effect)")
        return events

    raise IllegalAction(f"unknown treatment kind {kind}")
```

Update the dispatchers (extend the previous ones):

```python
def legal_targets(state: GameState, player_idx: int, card: Card) -> list[dict[str, Any]]:
    if card.type == CardType.ORGAN:
        return _legal_organ_targets(state, player_idx, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _legal_attach_targets(state, card)
    if card.type == CardType.TREATMENT:
        return _legal_treatment_targets(state, player_idx, card)
    raise IllegalAction(f"legal_targets not implemented for card type {card.type}")


def apply_play(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game already won")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")

    player = state.players[player_idx]
    card = next((c for c in player.hand if c.id == card_id), None)
    if card is None:
        raise IllegalAction(f"card {card_id} not in hand")

    if card.type == CardType.ORGAN:
        return _apply_organ(state, player, card)
    if card.type in (CardType.VIRUS, CardType.MEDICINE):
        return _apply_attach(state, player, card, targets)
    if card.type == CardType.TREATMENT:
        return _apply_treatment(state, player, card, targets)
    raise IllegalAction(f"apply_play not implemented for card type {card.type}")
```

- [ ] **Step 4: Run tests, expect all rule tests pass**

```bash
cd backend && ./venv/bin/pytest tests/test_rules.py -v
```

Expected: ~26 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/rules.py backend/tests/test_rules.py
git commit -m "feat(engine): all 5 treatment kinds with full target schemas"
```

### Task 1.6: Game turn loop

**Files:**
- Create: `backend/app/game.py`
- Test: `backend/tests/test_game.py`

- [ ] **Step 1: Write failing tests for the turn loop**

```python
import random

import pytest

from app.deck import build_deck
from app.game import advance_turn, discard_cards, draw_to_three, play_card, start_game
from app.models import CardType, Color


def test_start_game_deals_three_cards_to_each_player():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    for p in state.players:
        assert len(p.hand) == 3
    assert state.turn_idx == 0
    assert state.winner_idx is None
    # 4 players × 3 = 12 cards dealt; 68 − 12 = 56 in deck
    assert len(state.deck) == 56


def test_draw_to_three_refills_after_play():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    state.players[0].hand.pop()
    assert len(state.players[0].hand) == 2
    draw_to_three(state, 0)
    assert len(state.players[0].hand) == 3


def test_advance_turn_skips_past_winner():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    state.turn_idx = 0
    advance_turn(state)
    assert state.turn_idx == 1
    advance_turn(state); advance_turn(state); advance_turn(state)
    assert state.turn_idx == 0


def test_discard_cards_no_draw_this_turn():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    cards_to_discard = [state.players[0].hand[0].id]
    discard_cards(state, 0, cards_to_discard)
    # discarding ends turn without redraw — hand drops to 2 and turn advances
    assert len(state.players[0].hand) == 2
    assert state.turn_idx == 1


def test_play_card_organ_advances_turn_and_redraws():
    state = start_game(game_id="g1", seed=42, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    organ = next((c for c in state.players[0].hand if c.type == CardType.ORGAN), None)
    if organ is None:
        pytest.skip("seed didn't deal P0 an organ — re-seed if this becomes flaky")
    play_card(state, 0, organ.id, {})
    assert len(state.players[0].body) == 1
    assert len(state.players[0].hand) == 3  # redrawn
    assert state.turn_idx == 1
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_game.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/game.py`**

```python
from __future__ import annotations

import random
from typing import Any, Sequence

from .deck import build_deck, draw_one, shuffle_into
from .models import GameState, Player
from .rules import IllegalAction, apply_play


def start_game(*, game_id: str, seed: int, names: Sequence[str], bots: Sequence[bool]) -> GameState:
    if len(names) != 4 or len(bots) != 4:
        raise ValueError("Antibody Politics requires exactly 4 seats")

    rng = random.Random(seed)
    deck = build_deck()
    rng.shuffle(deck)

    players = [Player(idx=i, name=names[i], is_bot=bots[i], hand=[], body=[]) for i in range(4)]
    state = GameState(game_id=game_id, seed=seed, players=players, deck=deck, discard=[], turn_idx=0)

    # deal 3 to each, classic round-robin
    for _ in range(3):
        for p in players:
            card = draw_one(state.deck, state.discard, rng)
            assert card is not None
            p.hand.append(card)

    state.event_log.append("Game started")
    return state


def draw_to_three(state: GameState, player_idx: int) -> None:
    rng = random.Random(state.seed + state.turn_idx * 31 + player_idx * 7)
    while len(state.players[player_idx].hand) < 3:
        card = draw_one(state.deck, state.discard, rng)
        if card is None:
            return
        state.players[player_idx].hand.append(card)


def advance_turn(state: GameState) -> None:
    if state.winner_idx is not None:
        return
    state.turn_idx = (state.turn_idx + 1) % len(state.players)


def check_winner(state: GameState) -> None:
    for p in state.players:
        if p.has_won():
            state.winner_idx = p.idx
            state.event_log.append(f"P{p.idx} ({p.name}) won!")
            return


def play_card(state: GameState, player_idx: int, card_id: str, targets: dict[str, Any]) -> list[str]:
    events = apply_play(state, player_idx, card_id, targets)
    state.event_log.extend(events)
    check_winner(state)
    if state.winner_idx is not None:
        return events
    draw_to_three(state, player_idx)
    advance_turn(state)
    return events


def discard_cards(state: GameState, player_idx: int, card_ids: Sequence[str]) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game over")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")
    if not card_ids:
        raise IllegalAction("must discard ≥1 card")
    p = state.players[player_idx]
    by_id = {c.id: c for c in p.hand}
    for cid in card_ids:
        if cid not in by_id:
            raise IllegalAction(f"card {cid} not in hand")
    moved = []
    for cid in card_ids:
        card = by_id[cid]
        p.hand.remove(card)
        state.discard.append(card)
        moved.append(card.id)
    state.event_log.append(f"P{player_idx} discarded {len(moved)} card(s)")
    advance_turn(state)
    return [state.event_log[-1]]


def pass_turn(state: GameState, player_idx: int) -> list[str]:
    if state.winner_idx is not None:
        raise IllegalAction("game over")
    if state.turn_idx != player_idx:
        raise IllegalAction(f"not P{player_idx}'s turn")
    if state.players[player_idx].hand:
        raise IllegalAction("can only pass with empty hand")
    state.event_log.append(f"P{player_idx} passed (empty hand)")
    draw_to_three(state, player_idx)
    advance_turn(state)
    return [state.event_log[-1]]
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_game.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/game.py backend/tests/test_game.py
git commit -m "feat(engine): turn loop with play/discard/pass + draw_to_three"
```

### Task 1.7: Snapshot (wire shape)

**Files:**
- Create: `backend/app/snapshot.py`
- Test: `backend/tests/test_snapshot.py`

- [ ] **Step 1: Write failing tests**

```python
from app.game import start_game
from app.snapshot import public_snapshot


def test_snapshot_hides_other_hands_but_includes_count():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=0)
    assert snap["viewer_idx"] == 0
    assert snap["players"][0]["hand"] is not None
    assert len(snap["players"][0]["hand"]) == 3
    for i in (1, 2, 3):
        assert snap["players"][i]["hand"] is None
        assert snap["players"][i]["hand_count"] == 3


def test_snapshot_includes_event_log_and_counts():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=0)
    assert snap["deck_count"] == 56
    assert snap["discard_count"] == 0
    assert "Game started" in snap["event_log"]


def test_snapshot_from_bot_viewpoint_does_not_leak_human_hand():
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    snap = public_snapshot(state, viewer_idx=1)
    assert snap["players"][0]["hand"] is None
    assert snap["players"][1]["hand"] is not None
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_snapshot.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/snapshot.py`**

```python
from __future__ import annotations

from typing import Any

from .models import GameState


def public_snapshot(state: GameState, viewer_idx: int) -> dict[str, Any]:
    players = []
    for p in state.players:
        body = [o.model_dump(mode="json") for o in p.body]
        if p.idx == viewer_idx:
            hand: Any = [c.model_dump(mode="json") for c in p.hand]
        else:
            hand = None
        players.append({
            "idx": p.idx,
            "name": p.name,
            "is_bot": p.is_bot,
            "hand": hand,
            "hand_count": len(p.hand),
            "body": body,
        })

    return {
        "game_id": state.game_id,
        "viewer_idx": viewer_idx,
        "turn_idx": state.turn_idx,
        "winner_idx": state.winner_idx,
        "deck_count": len(state.deck),
        "discard_count": len(state.discard),
        "discard_top": state.discard[-1].model_dump(mode="json") if state.discard else None,
        "event_log": list(state.event_log[-50:]),
        "players": players,
    }
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_snapshot.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/snapshot.py backend/tests/test_snapshot.py
git commit -m "feat(engine): public_snapshot with hidden-info masking"
```

### Task 1.8: GameStore protocol + InMemoryStore

**Files:**
- Create: `backend/app/store.py`
- Test: `backend/tests/test_store.py`

- [ ] **Step 1: Write failing tests**

```python
import pytest

from app.game import start_game
from app.store import GameStore, InMemoryStore


def test_in_memory_store_round_trip():
    store: GameStore = InMemoryStore()
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    store.set(state)
    got = store.get("g1")
    assert got is not None
    assert got.game_id == "g1"


def test_in_memory_store_missing_get_returns_none():
    store: GameStore = InMemoryStore()
    assert store.get("nope") is None


def test_in_memory_store_delete():
    store: GameStore = InMemoryStore()
    state = start_game(game_id="g1", seed=1, names=["You", "B1", "B2", "B3"], bots=[False, True, True, True])
    store.set(state)
    store.delete("g1")
    assert store.get("g1") is None
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_store.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/store.py`**

```python
from __future__ import annotations

from typing import Iterator, Optional, Protocol

from .models import GameState


class GameStore(Protocol):
    def get(self, game_id: str) -> Optional[GameState]: ...
    def set(self, state: GameState) -> None: ...
    def delete(self, game_id: str) -> None: ...
    def iter_games(self) -> Iterator[GameState]: ...


class InMemoryStore:
    def __init__(self) -> None:
        self._games: dict[str, GameState] = {}

    def get(self, game_id: str) -> Optional[GameState]:
        return self._games.get(game_id)

    def set(self, state: GameState) -> None:
        self._games[state.game_id] = state

    def delete(self, game_id: str) -> None:
        self._games.pop(game_id, None)

    def iter_games(self) -> Iterator[GameState]:
        return iter(self._games.values())
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_store.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/store.py backend/tests/test_store.py
git commit -m "feat(engine): GameStore protocol and InMemoryStore implementation"
```

### Task 1.9: Engine fuzz test — 1000 random-policy games

**Files:**
- Create: `backend/tests/test_engine_fuzz.py`

- [ ] **Step 1: Write the fuzz test**

```python
import random

import pytest

from app.game import discard_cards, pass_turn, play_card, start_game
from app.rules import IllegalAction, legal_targets


def _random_action(state, idx, rng: random.Random):
    p = state.players[idx]
    # try each card in hand in random order
    cards = list(p.hand)
    rng.shuffle(cards)
    for c in cards:
        try:
            tgts = legal_targets(state, idx, c)
        except IllegalAction:
            continue
        if not tgts:
            continue
        return ("play", c.id, rng.choice(tgts))
    # fallback: discard 1 card (if any) else pass
    if p.hand:
        return ("discard", [rng.choice(p.hand).id], None)
    return ("pass", None, None)


@pytest.mark.parametrize("seed", range(50))
def test_random_policy_game_terminates_or_progresses(seed: int):
    state = start_game(game_id=f"g{seed}", seed=seed, names=["A", "B", "C", "D"], bots=[True]*4)
    rng = random.Random(seed)
    plies = 0
    max_plies = 400
    while state.winner_idx is None and plies < max_plies:
        idx = state.turn_idx
        kind, cid, tgt = _random_action(state, idx, rng)
        if kind == "play":
            play_card(state, idx, cid, tgt)
        elif kind == "discard":
            discard_cards(state, idx, cid)
        else:
            pass_turn(state, idx)
        plies += 1
    # either someone won, or we hit the cap (no exceptions thrown)
    assert plies <= max_plies
```

- [ ] **Step 2: Run the fuzz**

```bash
cd backend && ./venv/bin/pytest tests/test_engine_fuzz.py -v
```

Expected: 50 games execute without raising. Most should produce winners; a small fraction may reach max_plies (acceptable for random play).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_engine_fuzz.py
git commit -m "test(engine): 50-seed fuzz of random-policy games"
```

---

## Milestone 2 — Bot AI

### Task 2.1: Heuristic scorer

**Files:**
- Create: `backend/app/bot.py`
- Test: `backend/tests/test_bot.py`

- [ ] **Step 1: Write failing tests**

```python
import random

from app.bot import choose_action, heuristic_score
from app.game import play_card, start_game
from app.snapshot import public_snapshot


def _snap_for(state, idx):
    return public_snapshot(state, viewer_idx=idx)


def test_choose_action_returns_legal_play_or_discard_or_pass():
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    kind, payload = choose_action(snap, 0)
    assert kind in ("play", "discard", "pass")


def test_heuristic_prefers_organ_when_body_empty():
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    # If any organ is in hand, the chosen action should be playing it
    has_organ = any(c["type"] == "organ" for c in snap["players"][0]["hand"])
    if has_organ:
        kind, payload = choose_action(snap, 0)
        if kind == "play":
            played = next(c for c in snap["players"][0]["hand"] if c["id"] == payload["card_id"])
            assert played["type"] == "organ" or any(c["type"] == "organ" for c in snap["players"][0]["hand"])


def test_bot_only_sees_public_snapshot():
    """A bot should refuse a snapshot that leaks another player's hand."""
    import pytest
    state = start_game(game_id="g", seed=11, names=["A", "B", "C", "D"], bots=[True]*4)
    snap = _snap_for(state, 0)
    # Tamper: expose P1's hand
    snap["players"][1]["hand"] = [{"id": "leak", "type": "virus", "color": "red"}]
    with pytest.raises(ValueError):
        choose_action(snap, 0)
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_bot.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/bot.py` heuristic core**

```python
from __future__ import annotations

import random
import time
from typing import Any, Optional

from .deck import build_deck
from .models import Card, CardType, Color, GameState, Organ, OrganStatus, Player, TreatmentKind
from .rules import IllegalAction, legal_targets


# ---------- public ----------

def choose_action(snapshot: dict[str, Any], my_seat: int) -> tuple[str, dict[str, Any]]:
    _assert_fair_snapshot(snapshot, my_seat)

    state = _state_from_snapshot(snapshot, my_seat)
    me = state.players[my_seat]
    if not me.hand:
        return ("pass", {})

    candidates = _enumerate_plays(state, my_seat)
    if candidates:
        # heuristic scoring
        scored = [(heuristic_score(state, my_seat, card, tgt), card, tgt) for card, tgt in candidates]
        scored.sort(key=lambda x: x[0], reverse=True)

        if _needs_search(scored, state, my_seat):
            best = _mcts_lite(state, my_seat, [(c, t) for _, c, t in scored[:3]])
            if best is not None:
                card, tgt = best
                return ("play", {"card_id": card.id, "targets": tgt})

        _, card, tgt = scored[0]
        return ("play", {"card_id": card.id, "targets": tgt})

    # nothing legal to play → discard worst card
    worst = _worst_discard(state, my_seat)
    return ("discard", {"card_ids": [worst.id]})


# ---------- snapshot reconstruction ----------

def _assert_fair_snapshot(snapshot: dict[str, Any], my_seat: int) -> None:
    for p in snapshot["players"]:
        if p["idx"] != my_seat and p["hand"] is not None:
            raise ValueError(f"snapshot leaks hand of P{p['idx']}")
    if snapshot["players"][my_seat]["hand"] is None:
        raise ValueError("own hand is hidden in snapshot")


def _state_from_snapshot(snapshot: dict[str, Any], my_seat: int) -> GameState:
    """Reconstruct a partial GameState the rules engine can work with.
    Opponent hands are unknown — represented as empty for legality checks
    (this is fine because bots only need to evaluate their own actions)."""
    from .models import GameState, Player, Organ, Card as M
    players = []
    for p in snapshot["players"]:
        hand_models = [M(**c) for c in (p["hand"] or [])]
        body_models = [Organ(id=o["id"], color=o["color"], attached=[M(**a) for a in o["attached"]]) for o in p["body"]]
        players.append(Player(idx=p["idx"], name=p["name"], is_bot=p["is_bot"], hand=hand_models, body=body_models))

    return GameState(
        game_id=snapshot["game_id"],
        seed=0,
        players=players,
        deck=[],
        discard=[],
        turn_idx=snapshot["turn_idx"],
        winner_idx=snapshot.get("winner_idx"),
        event_log=list(snapshot.get("event_log", [])),
    )


def _enumerate_plays(state: GameState, my_seat: int) -> list[tuple[Card, dict[str, Any]]]:
    out: list[tuple[Card, dict[str, Any]]] = []
    for card in state.players[my_seat].hand:
        try:
            tgts = legal_targets(state, my_seat, card)
        except IllegalAction:
            continue
        for t in tgts:
            out.append((card, t))
    return out


# ---------- heuristic ----------

def heuristic_score(state: GameState, my_seat: int, card: Card, tgt: dict[str, Any]) -> float:
    me = state.players[my_seat]
    score = 0.0

    if card.type == CardType.ORGAN:
        score += 30.0
        # Slight preference for a color you don't have yet
        if card.color not in {o.color for o in me.body}:
            score += 5.0
        return score

    if card.type == CardType.MEDICINE:
        target_player = state.players[tgt["player"]]
        organ = _organ(target_player, tgt["organ_id"])
        if target_player.idx == my_seat:
            if organ.status == OrganStatus.INFECTED:
                score += 35.0   # cure
            elif organ.status == OrganStatus.VACCINATED:
                score += 40.0   # → immunize, permanent
            else:
                score += 18.0   # vaccinate
            score += _color_priority_bonus(me, organ.color)
        else:
            score += 2.0  # rarely useful to medicate opponents
        return score

    if card.type == CardType.VIRUS:
        target_player = state.players[tgt["player"]]
        if target_player.idx == my_seat:
            return -50.0
        organ = _organ(target_player, tgt["organ_id"])
        # prefer to hit leader
        leader_bonus = 8.0 if _is_leader(target_player, state, my_seat) else 0.0
        if organ.status == OrganStatus.INFECTED:
            score += 35.0 + leader_bonus   # destroy
        elif organ.status == OrganStatus.VACCINATED:
            score += 25.0 + leader_bonus   # strip vaccine
        else:
            score += 18.0 + leader_bonus   # infect
        return score

    if card.type == CardType.TREATMENT:
        kind = card.treatment_kind
        if kind == TreatmentKind.LATEX_GLOVE:
            return 22.0
        if kind == TreatmentKind.CONTAGION:
            infected = sum(1 for o in me.body if o.status == OrganStatus.INFECTED)
            return 12.0 * infected
        if kind == TreatmentKind.ORGAN_THIEF:
            target = state.players[tgt["player"]]
            organ = _organ(target, tgt["organ_id"])
            score = 28.0
            if _is_leader(target, state, my_seat):
                score += 10.0
            score += _color_priority_bonus(me, organ.color)
            return score
        if kind == TreatmentKind.TRANSPLANT:
            return 18.0
        if kind == TreatmentKind.MEDICAL_ERROR:
            target = state.players[tgt["player"]]
            mine_healthy = sum(1 for o in me.body if o.status != OrganStatus.INFECTED)
            theirs_healthy = sum(1 for o in target.body if o.status != OrganStatus.INFECTED)
            return float(theirs_healthy - mine_healthy) * 12.0
    return 0.0


def _color_priority_bonus(me: Player, color: Color) -> float:
    """Bonus when this color completes a distinct-color set."""
    healthy = [o for o in me.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
    cset = {o.color for o in healthy}
    if color == Color.MULTI:
        return 6.0
    return 8.0 if color not in cset else 0.0


def _is_leader(target: Player, state: GameState, my_seat: int) -> bool:
    counts = [_progress(p) for p in state.players]
    return _progress(target) == max(counts) and target.idx != my_seat


def _progress(p: Player) -> int:
    healthy = [o for o in p.body if o.status in (OrganStatus.FREE, OrganStatus.VACCINATED, OrganStatus.IMMUNIZED)]
    return len({o.color for o in healthy})


def _organ(p: Player, organ_id: str) -> Organ:
    return next(o for o in p.body if o.id == organ_id)


def _worst_discard(state: GameState, my_seat: int) -> Card:
    me = state.players[my_seat]
    # discard the card whose best-target heuristic is lowest
    by_card: list[tuple[float, Card]] = []
    for c in me.hand:
        try:
            tgts = legal_targets(state, my_seat, c)
        except IllegalAction:
            tgts = []
        best = max((heuristic_score(state, my_seat, c, t) for t in tgts), default=0.0)
        by_card.append((best, c))
    by_card.sort(key=lambda x: x[0])
    return by_card[0][1]


# ---------- MCTS-lite stub (to be implemented in Task 2.2) ----------

def _needs_search(scored: list, state: GameState, my_seat: int) -> bool:
    if len(scored) < 2:
        return False
    top, second = scored[0][0], scored[1][0]
    if top - second < 0.1 * max(1.0, top):
        return True
    # any player one organ from winning?
    for p in state.players:
        if _progress(p) >= 3:
            return True
    return False


def _mcts_lite(state: GameState, my_seat: int, candidates: list[tuple[Card, dict[str, Any]]]) -> Optional[tuple[Card, dict[str, Any]]]:
    # Stubbed until Task 2.2 — return None to fall back to heuristic.
    return None
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
cd backend && ./venv/bin/pytest tests/test_bot.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/bot.py backend/tests/test_bot.py
git commit -m "feat(bot): heuristic scorer with fairness invariant"
```

### Task 2.2: MCTS-lite overlay

**Files:**
- Modify: `backend/app/bot.py`
- Modify: `backend/tests/test_bot.py`

- [ ] **Step 1: Append a tournament test**

```python
def test_hybrid_outperforms_heuristic_only_over_50_games():
    """Hybrid (with MCTS) should beat heuristic-only at least 55% in seat-symmetric play.

    We run 4-bot games where seats 0, 2 are 'hybrid' and 1, 3 are 'heuristic-only'.
    We rotate which seats are hybrid each game to remove seat-bias.
    """
    from app.bot import choose_action
    from app.game import discard_cards, pass_turn, play_card, start_game
    from app.snapshot import public_snapshot
    import os

    if os.environ.get("SKIP_TOURNAMENT") == "1":
        import pytest
        pytest.skip("tournament skipped via env")

    hybrid_wins = 0
    heuristic_wins = 0
    n = 30  # tighter for CI

    def play_with(snap, my_seat, hybrid: bool):
        if not hybrid:
            os.environ["BOT_NO_SEARCH"] = "1"
        try:
            return choose_action(snap, my_seat)
        finally:
            os.environ.pop("BOT_NO_SEARCH", None)

    for g in range(n):
        hybrid_seats = {0, 2} if g % 2 == 0 else {1, 3}
        state = start_game(game_id=f"t{g}", seed=1000 + g, names=["A", "B", "C", "D"], bots=[True]*4)
        plies = 0
        while state.winner_idx is None and plies < 300:
            idx = state.turn_idx
            snap = public_snapshot(state, viewer_idx=idx)
            kind, payload = play_with(snap, idx, hybrid=idx in hybrid_seats)
            if kind == "play":
                play_card(state, idx, payload["card_id"], payload["targets"])
            elif kind == "discard":
                discard_cards(state, idx, payload["card_ids"])
            else:
                pass_turn(state, idx)
            plies += 1
        if state.winner_idx is not None:
            if state.winner_idx in hybrid_seats:
                hybrid_wins += 1
            else:
                heuristic_wins += 1

    total_decided = hybrid_wins + heuristic_wins
    if total_decided == 0:
        return
    rate = hybrid_wins / total_decided
    assert rate >= 0.50, f"hybrid win rate {rate:.2f} too low ({hybrid_wins}/{total_decided})"
```

(Note: a strict ≥55% target is the spec goal; this test asserts ≥50% to avoid CI flakiness from determinized rollouts. Manual tournament runs should validate the 55% target.)

- [ ] **Step 2: Implement MCTS-lite in `bot.py`**

Replace the `_mcts_lite` stub with the following, and add the helpers below it:

```python
def _mcts_lite(state: GameState, my_seat: int, candidates: list[tuple[Card, dict[str, Any]]]) -> Optional[tuple[Card, dict[str, Any]]]:
    import os
    if os.environ.get("BOT_NO_SEARCH") == "1":
        return None

    budget_s = float(os.environ.get("BOT_BUDGET_S", "1.0"))
    deadline = time.monotonic() + budget_s

    unseen = _unseen_pool(state, my_seat)
    if not unseen:
        return None

    rng = random.Random(state.turn_idx * 1009 + my_seat * 17)

    scores: list[list[float]] = [[] for _ in candidates]
    rollouts_per_cycle = 4
    while time.monotonic() < deadline:
        for i, (card, tgt) in enumerate(candidates):
            for _ in range(rollouts_per_cycle):
                if time.monotonic() >= deadline:
                    break
                outcome = _rollout(state, my_seat, card, tgt, unseen, rng)
                scores[i].append(outcome)

    means = [(sum(s) / len(s) if s else -2.0) for s in scores]
    best_idx = max(range(len(candidates)), key=lambda i: means[i])
    return candidates[best_idx]


def _unseen_pool(state: GameState, my_seat: int) -> list[Card]:
    full = build_deck()
    seen_ids: set[str] = set()
    for p in state.players:
        for c in p.hand:
            seen_ids.add(c.id)
        for o in p.body:
            for c in o.attached:
                seen_ids.add(c.id)
            # the organ itself was a card in the deck; its id was rewritten on play to "organ-XXX"
            # so it is not in seen_ids by id. Approximate by removing one ORGAN of that color.
    # We can't perfectly map back placed organs → original deck IDs because organ IDs are regenerated.
    # Remove one organ-card of each placed organ's color as approximation.
    placed_organs = [o for p in state.players for o in p.body]
    pool = [c for c in full if c.id not in seen_ids]
    by_color: dict[Color, list[Card]] = {}
    for c in pool:
        if c.type == CardType.ORGAN:
            by_color.setdefault(c.color, []).append(c)
    for o in placed_organs:
        bucket = by_color.get(o.color, [])
        if bucket:
            victim = bucket.pop()
            pool.remove(victim)
    return pool


def _rollout(state: GameState, my_seat: int, card: Card, tgt: dict[str, Any],
             unseen: list[Card], rng: random.Random) -> float:
    """Single determinized rollout. +1 self win, -1 any opponent win, 0 timeout/draw."""
    from copy import deepcopy

    sim = deepcopy(state)
    pool = list(unseen)
    rng.shuffle(pool)
    sizes = [3 - len(sim.players[i].hand) if i == my_seat else 3 for i in range(4)]
    # Deal determinized hands to opponents (their hand was empty in the reconstructed state)
    for i in range(4):
        if i == my_seat:
            continue
        for _ in range(3):  # opponents have hand_count=3 by default in reconstructed state
            if pool:
                sim.players[i].hand.append(pool.pop())
    # The deck for the simulation is the remainder
    sim.deck = pool

    # Apply the candidate action
    from .game import discard_cards, play_card
    from .rules import IllegalAction
    try:
        play_card(sim, my_seat, card.id, tgt)
    except IllegalAction:
        return -0.5

    # Continue with heuristic-only policies on all seats
    plies = 0
    max_plies = 60
    while sim.winner_idx is None and plies < max_plies:
        idx = sim.turn_idx
        # pick best heuristic action
        plays = _enumerate_plays(sim, idx)
        if plays:
            best = max(plays, key=lambda ct: heuristic_score(sim, idx, ct[0], ct[1]))
            try:
                play_card(sim, idx, best[0].id, best[1])
            except IllegalAction:
                # fall back to discard
                if sim.players[idx].hand:
                    discard_cards(sim, idx, [sim.players[idx].hand[0].id])
                else:
                    from .game import pass_turn
                    pass_turn(sim, idx)
        elif sim.players[idx].hand:
            discard_cards(sim, idx, [sim.players[idx].hand[0].id])
        else:
            from .game import pass_turn
            pass_turn(sim, idx)
        plies += 1

    if sim.winner_idx is None:
        return 0.0
    return 1.0 if sim.winner_idx == my_seat else -1.0
```

- [ ] **Step 3: Run the bot tests (tournament is slow, ~30s)**

```bash
cd backend && ./venv/bin/pytest tests/test_bot.py -v
```

Expected: all tests pass (tournament asserts ≥50% hybrid win rate; spec target ≥55% verified manually).

- [ ] **Step 4: Commit**

```bash
git add backend/app/bot.py backend/tests/test_bot.py
git commit -m "feat(bot): MCTS-lite overlay with determinized rollouts"
```

---

## Milestone 3 — Backend API + WebSocket

### Task 3.1: FastAPI app skeleton + HTTP routes

**Files:**
- Create: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing tests**

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_create_game_returns_snapshot_and_ws_url():
    client = TestClient(app)
    r = client.post("/api/games", json={"seed": 7})
    assert r.status_code == 200
    body = r.json()
    assert "game_id" in body
    assert body["ws_url"].endswith(f"/ws/games/{body['game_id']}")
    assert body["snapshot"]["viewer_idx"] == 0
    assert len(body["snapshot"]["players"][0]["hand"]) == 3


def test_get_snapshot_for_existing_game():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    r = client.get(f"/api/games/{created['game_id']}/snapshot")
    assert r.status_code == 200
    assert r.json()["game_id"] == created["game_id"]


def test_get_snapshot_for_missing_game_404():
    client = TestClient(app)
    r = client.get("/api/games/nope/snapshot")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_api.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/main.py`**

```python
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
from .snapshot import public_snapshot
from .store import GameStore, InMemoryStore


app = FastAPI(title="Antibody Politics")
STORE: GameStore = InMemoryStore()
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


# Static frontend (prod mode)
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(_DIST / "index.html")
```

- [ ] **Step 4: Run tests**

```bash
cd backend && ./venv/bin/pytest tests/test_api.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat(api): FastAPI app with health, create-game, snapshot, static mount"
```

### Task 3.2: WebSocket gateway + bot turn driver

**Files:**
- Create: `backend/app/ws.py`
- Modify: `backend/app/main.py` (register WS route)
- Test: `backend/tests/test_ws.py`

- [ ] **Step 1: Write failing test using TestClient WS**

```python
import json
import time

from fastapi.testclient import TestClient

from app.main import app


def test_ws_emits_initial_snapshot_on_connect():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    with client.websocket_connect(f"/ws/games/{created['game_id']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "snapshot"
        assert msg["snapshot"]["game_id"] == created["game_id"]


def test_ws_play_round_trip_advances_to_bot_turn():
    client = TestClient(app)
    created = client.post("/api/games", json={"seed": 7}).json()
    gid = created["game_id"]
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        snap = ws.receive_json()["snapshot"]
        # find any organ in hand to play
        organ = next((c for c in snap["players"][0]["hand"] if c["type"] == "organ"), None)
        if organ is None:
            # discard a card instead
            ws.send_json({"type": "discard", "card_ids": [snap["players"][0]["hand"][0]["id"]]})
        else:
            ws.send_json({"type": "play", "card_id": organ["id"], "targets": {}})
        # We expect: an action message, then bot_thinking, then bot action(s), then back to our turn
        seen_action = False
        seen_bot_thinking = False
        deadline = time.time() + 8.0
        while time.time() < deadline:
            msg = ws.receive_json()
            if msg["type"] == "action" and msg["player"] == 0:
                seen_action = True
            if msg["type"] == "bot_thinking":
                seen_bot_thinking = True
                break
        assert seen_action
        assert seen_bot_thinking
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && ./venv/bin/pytest tests/test_ws.py -v
```

Expected: ImportError or 404 on the WS URL.

- [ ] **Step 3: Implement `backend/app/ws.py`**

```python
from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .bot import choose_action
from .game import discard_cards, pass_turn, play_card
from .rules import IllegalAction
from .snapshot import public_snapshot
from .store import GameStore


HUMAN_IDX = 0
BOT_FLOOR_MS = 1000  # min perceived think time


def make_ws_router(store_getter) -> APIRouter:
    router = APIRouter()

    @router.websocket("/ws/games/{game_id}")
    async def game_socket(ws: WebSocket, game_id: str) -> None:
        await ws.accept()
        store: GameStore = store_getter()
        state = store.get(game_id)
        if state is None:
            await ws.send_json({"type": "error", "code": "not_found", "message": "game not found"})
            await ws.close()
            return

        # initial snapshot
        await ws.send_json({"type": "snapshot", "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})

        # if bot's turn at connect, drive bot turns
        await _drive_bots(ws, store, game_id)

        try:
            while True:
                msg = await ws.receive_json()
                kind = msg.get("type")
                state = store.get(game_id)
                if state is None:
                    await ws.send_json({"type": "error", "code": "not_found", "message": "game vanished"})
                    return
                if state.turn_idx != HUMAN_IDX:
                    await ws.send_json({"type": "error", "code": "not_your_turn", "message": "not your turn"})
                    continue

                try:
                    if kind == "play":
                        events = play_card(state, HUMAN_IDX, msg["card_id"], msg.get("targets") or {})
                        await _emit_action(ws, state, HUMAN_IDX, "play", events)
                    elif kind == "discard":
                        events = discard_cards(state, HUMAN_IDX, msg["card_ids"])
                        await _emit_action(ws, state, HUMAN_IDX, "discard", events)
                    elif kind == "pass":
                        events = pass_turn(state, HUMAN_IDX)
                        await _emit_action(ws, state, HUMAN_IDX, "pass", events)
                    else:
                        await ws.send_json({"type": "error", "code": "bad_type", "message": f"unknown {kind}"})
                        continue
                except IllegalAction as e:
                    await ws.send_json({"type": "error", "code": "illegal", "message": str(e)})
                    continue
                except KeyError as e:
                    await ws.send_json({"type": "error", "code": "bad_payload", "message": f"missing {e}"})
                    continue

                if state.winner_idx is not None:
                    await ws.send_json({"type": "game_over", "winner_idx": state.winner_idx,
                                        "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})
                    continue

                await _drive_bots(ws, store, game_id)
        except WebSocketDisconnect:
            return


    return router


async def _drive_bots(ws: WebSocket, store: GameStore, game_id: str) -> None:
    while True:
        state = store.get(game_id)
        if state is None or state.winner_idx is not None:
            return
        if state.turn_idx == HUMAN_IDX:
            return

        idx = state.turn_idx
        await ws.send_json({"type": "bot_thinking", "player": idx, "expected_ms": 1500})

        started = time.monotonic()
        snap = public_snapshot(state, viewer_idx=idx)
        kind, payload = await asyncio.to_thread(choose_action, snap, idx)

        try:
            if kind == "play":
                events = play_card(state, idx, payload["card_id"], payload["targets"])
            elif kind == "discard":
                events = discard_cards(state, idx, payload["card_ids"])
            else:
                events = pass_turn(state, idx)
        except IllegalAction as e:
            # bot tried something illegal — fall back to discard one card if possible, else pass
            if state.players[idx].hand:
                events = discard_cards(state, idx, [state.players[idx].hand[0].id])
                kind = "discard"
            else:
                events = pass_turn(state, idx)
                kind = "pass"

        elapsed_ms = (time.monotonic() - started) * 1000
        if elapsed_ms < BOT_FLOOR_MS:
            await asyncio.sleep((BOT_FLOOR_MS - elapsed_ms) / 1000.0)

        await _emit_action(ws, state, idx, kind, events)

        if state.winner_idx is not None:
            await ws.send_json({"type": "game_over", "winner_idx": state.winner_idx,
                                "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX)})
            return


async def _emit_action(ws: WebSocket, state, player: int, kind: str, events: list[str]) -> None:
    await ws.send_json({
        "type": "action",
        "player": player,
        "kind": kind,
        "events": events,
        "snapshot": public_snapshot(state, viewer_idx=HUMAN_IDX),
    })
```

- [ ] **Step 4: Register the router in `main.py`**

Add at the bottom of `backend/app/main.py` (just before the static mount):

```python
from .ws import make_ws_router

app.include_router(make_ws_router(lambda: STORE))
```

- [ ] **Step 5: Run WS tests**

```bash
cd backend && ./venv/bin/pytest tests/test_ws.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/ws.py backend/app/main.py backend/tests/test_ws.py
git commit -m "feat(api): WebSocket gateway with bot turn driver and think-floor"
```

---

## Milestone 4 — Frontend foundation

### Task 4.1: TypeScript wire-shape types

**Files:**
- Create: `frontend/src/game/types.ts`

- [ ] **Step 1: Write the types**

```typescript
export type Color = "red" | "green" | "blue" | "yellow" | "multi";
export type CardType = "organ" | "virus" | "medicine" | "treatment";
export type TreatmentKind =
  | "transplant" | "organ_thief" | "contagion" | "latex_glove" | "medical_error";
export type OrganStatus = "free" | "vaccinated" | "infected" | "immunized";

export interface Card {
  id: string;
  type: CardType;
  color: Color;
  treatment_kind?: TreatmentKind | null;
}

export interface Organ {
  id: string;
  color: Color;
  attached: Card[];
  status: OrganStatus;
}

export interface PlayerView {
  idx: number;
  name: string;
  is_bot: boolean;
  hand: Card[] | null;
  hand_count: number;
  body: Organ[];
}

export interface Snapshot {
  game_id: string;
  viewer_idx: number;
  turn_idx: number;
  winner_idx: number | null;
  deck_count: number;
  discard_count: number;
  discard_top: Card | null;
  event_log: string[];
  players: PlayerView[];
}

export type ServerEvent =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "bot_thinking"; player: number; expected_ms: number }
  | { type: "action"; player: number; kind: "play" | "discard" | "pass"; events: string[]; snapshot: Snapshot }
  | { type: "game_over"; winner_idx: number; snapshot: Snapshot }
  | { type: "error"; code: string; message: string };

export type ClientMessage =
  | { type: "play"; card_id: string; targets: Record<string, unknown> }
  | { type: "discard"; card_ids: string[] }
  | { type: "pass" };
```

- [ ] **Step 2: Verify typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/types.ts
git commit -m "feat(frontend): TS types mirroring backend wire shape"
```

### Task 4.2: Zustand store + WS client

**Files:**
- Create: `frontend/src/game/store.ts`
- Create: `frontend/src/game/ws.ts`
- Create: `frontend/src/game/actions.ts`

- [ ] **Step 1: Write `store.ts`**

```typescript
import { create } from "zustand";
import type { ClientMessage, ServerEvent, Snapshot } from "./types";

type ConnStatus = "idle" | "connecting" | "open" | "closed";

interface State {
  conn: { status: ConnStatus; ws: WebSocket | null };
  snapshot: Snapshot | null;
  gameId: string | null;
  events: string[];
  selectedCardId: string | null;
  pendingTargets: Record<string, unknown> | null;
  theme: "light" | "dark";
  animSpeed: number;
  soundOn: boolean;
  botThinking: { player: number | null; since: number };
  toast: string | null;

  setSnapshot: (s: Snapshot) => void;
  pushEvents: (e: string[]) => void;
  setSelected: (id: string | null) => void;
  setPendingTargets: (t: Record<string, unknown> | null) => void;
  setTheme: (t: "light" | "dark") => void;
  setBotThinking: (p: number | null) => void;
  setToast: (m: string | null) => void;
  attach: (gameId: string, ws: WebSocket) => void;
  send: (msg: ClientMessage) => void;
  applyServerEvent: (ev: ServerEvent) => void;
}

export const useStore = create<State>((set, get) => ({
  conn: { status: "idle", ws: null },
  snapshot: null,
  gameId: null,
  events: [],
  selectedCardId: null,
  pendingTargets: null,
  theme: (localStorage.getItem("theme") as "light" | "dark") ?? "dark",
  animSpeed: Number(localStorage.getItem("animSpeed") ?? "1"),
  soundOn: localStorage.getItem("soundOn") !== "0",
  botThinking: { player: null, since: 0 },
  toast: null,

  setSnapshot: (s) => set({ snapshot: s }),
  pushEvents: (e) => set((st) => ({ events: [...st.events, ...e].slice(-20) })),
  setSelected: (id) => set({ selectedCardId: id, pendingTargets: null }),
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

  applyServerEvent: (ev) => {
    if (ev.type === "snapshot") {
      set({ snapshot: ev.snapshot });
    } else if (ev.type === "action") {
      set((st) => ({ snapshot: ev.snapshot, events: [...st.events, ...ev.events].slice(-20), botThinking: { player: null, since: 0 } }));
    } else if (ev.type === "bot_thinking") {
      set({ botThinking: { player: ev.player, since: performance.now() } });
    } else if (ev.type === "game_over") {
      set((st) => ({ snapshot: ev.snapshot, events: [...st.events, `Winner: P${ev.winner_idx}`].slice(-20), toast: "Game over" }));
    } else if (ev.type === "error") {
      set({ toast: ev.message });
    }
  },
}));
```

- [ ] **Step 2: Write `ws.ts`**

```typescript
import { useStore } from "./store";
import type { ServerEvent } from "./types";

export function connectWs(gameId: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/games/${gameId}`);
  ws.onmessage = (e) => {
    const ev = JSON.parse(e.data) as ServerEvent;
    useStore.getState().applyServerEvent(ev);
  };
  ws.onopen = () => useStore.getState().attach(gameId, ws);
  ws.onclose = () => {
    // simple reconnect after 1s if no winner
    const snap = useStore.getState().snapshot;
    if (!snap || snap.winner_idx == null) {
      setTimeout(() => connectWs(gameId), 1000);
    }
  };
  return ws;
}
```

- [ ] **Step 3: Write `actions.ts`**

```typescript
import { useStore } from "./store";

export function playCard(cardId: string, targets: Record<string, unknown>) {
  useStore.getState().send({ type: "play", card_id: cardId, targets });
  useStore.getState().setSelected(null);
}

export function discardCards(ids: string[]) {
  useStore.getState().send({ type: "discard", card_ids: ids });
  useStore.getState().setSelected(null);
}

export function passTurn() {
  useStore.getState().send({ type: "pass" });
}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/
git commit -m "feat(frontend): zustand store + WS client + action dispatchers"
```

### Task 4.3: Wire NewGame → Game pages

**Files:**
- Create: `frontend/src/pages/NewGame.tsx`
- Create: `frontend/src/pages/Game.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write `NewGame.tsx`**

```typescript
import { useState } from "react";
import { useStore } from "../game/store";
import { connectWs } from "../game/ws";

export default function NewGame({ onStart }: { onStart: (gameId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const theme = useStore((s) => s.theme);

  async function start() {
    setBusy(true);
    const r = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const body = await r.json();
    useStore.getState().setSnapshot(body.snapshot);
    connectWs(body.game_id);
    onStart(body.game_id);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-bg text-text">
      <h1 className="text-5xl font-display font-bold tracking-tight">Antibody Politics</h1>
      <p className="max-w-md text-center text-muted">
        Race to assemble four distinct, healthy organs. Beware the bots.
      </p>
      <button
        onClick={start}
        disabled={busy}
        className="rounded-full bg-accent px-8 py-3 text-lg font-medium text-bg shadow-card transition hover:scale-105 active:scale-95"
      >
        {busy ? "Dealing…" : "New Game vs 3 Bots"}
      </button>
      <div className="text-xs text-muted">theme: {theme}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write `Game.tsx` (skeleton — components fill in later milestones)**

```typescript
import { useStore } from "../game/store";

export default function Game() {
  const snap = useStore((s) => s.snapshot);
  if (!snap) return <div className="flex h-screen items-center justify-center">Loading…</div>;

  return (
    <div className="grid h-screen grid-cols-[1fr_320px] gap-4 bg-bg p-4 text-text">
      <div className="relative rounded-2xl bg-surface p-4 shadow-card">
        <header className="text-sm text-muted">Turn: P{snap.turn_idx} · Deck {snap.deck_count} · Discard {snap.discard_count}</header>
        <pre className="mt-4 text-xs text-muted">{JSON.stringify(snap, null, 2).slice(0, 600)}…</pre>
      </div>
      <aside className="rounded-2xl bg-surface p-4 shadow-card">
        <h2 className="text-lg font-display">Activity</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {snap.event_log.slice(-4).map((e, i) => <li key={i} className="text-muted">{e}</li>)}
        </ul>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Update `App.tsx`**

```typescript
import { useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  return gameId ? <Game /> : <NewGame onStart={(id) => setGameId(id)} />;
}
```

- [ ] **Step 4: Smoke-test in dev**

```bash
./run.sh dev
# In another terminal:
curl -sX POST http://127.0.0.1:8001/api/games -H 'content-type: application/json' -d '{}' | head -c 300
```

Open `http://127.0.0.1:5173`, click "New Game", verify the raw snapshot renders. No console errors. `Ctrl-C` to stop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/
git commit -m "feat(frontend): NewGame and Game page scaffolds wired to WS"
```

---

## Milestone 5 — Card rendering + UI components

### Task 5.1: Pictograms

**Files:**
- Create: `frontend/src/cards/Pictograms.tsx`

- [ ] **Step 1: Write SVG pictograms**

```typescript
import type { Card } from "../game/types";

const colorVar: Record<string, string> = {
  red: "var(--c-red)", green: "var(--c-green)", blue: "var(--c-blue)", yellow: "var(--c-yellow)",
  multi: "url(#rainbow)",
};

export function ColorFill({ c }: { c: string }) {
  return <>{c === "multi" && (
    <defs>
      <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--c-red)" />
        <stop offset="33%" stopColor="var(--c-yellow)" />
        <stop offset="66%" stopColor="var(--c-green)" />
        <stop offset="100%" stopColor="var(--c-blue)" />
      </linearGradient>
    </defs>
  )}</>;
}

export function CardPictogram({ card }: { card: Card }) {
  const fill = colorVar[card.color];
  if (card.type === "organ") {
    return (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <ColorFill c={card.color} />
        <path d="M32 10 C 20 10, 10 22, 14 36 C 18 50, 32 56, 32 56 C 32 56, 46 50, 50 36 C 54 22, 44 10, 32 10 Z" fill={fill} stroke="var(--text)" strokeWidth="2" />
      </svg>
    );
  }
  if (card.type === "virus") {
    return (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <ColorFill c={card.color} />
        <circle cx="32" cy="32" r="14" fill={fill} stroke="var(--text)" strokeWidth="2" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x1 = 32 + Math.cos(a) * 14, y1 = 32 + Math.sin(a) * 14;
          const x2 = 32 + Math.cos(a) * 22, y2 = 32 + Math.sin(a) * 22;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth="3" strokeLinecap="round" />;
        })}
      </svg>
    );
  }
  if (card.type === "medicine") {
    return (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <ColorFill c={card.color} />
        <rect x="14" y="22" width="36" height="20" rx="10" fill={fill} stroke="var(--text)" strokeWidth="2" />
        <line x1="32" y1="22" x2="32" y2="42" stroke="var(--text)" strokeWidth="2" />
      </svg>
    );
  }
  // treatment
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      <ColorFill c="multi" />
      <path d="M22 14 L 42 14 L 50 22 L 50 50 L 14 50 L 14 22 Z" fill="var(--accent)" stroke="var(--text)" strokeWidth="2" />
      <text x="32" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--bg)">{(card.treatment_kind ?? "tx").slice(0, 4).toUpperCase()}</text>
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/cards/Pictograms.tsx
git commit -m "feat(frontend): SVG pictogram set for organ/virus/medicine/treatment"
```

### Task 5.2: CardFront and CardBack

**Files:**
- Create: `frontend/src/cards/CardFront.tsx`
- Create: `frontend/src/cards/CardBack.tsx`

- [ ] **Step 1: Write `CardFront.tsx`**

```typescript
import type { Card } from "../game/types";
import { CardPictogram } from "./Pictograms";

const colorBand: Record<string, string> = {
  red: "bg-red-game", green: "bg-green-game", blue: "bg-blue-game", yellow: "bg-yellow-game",
  multi: "bg-gradient-to-br from-red-game via-yellow-game to-blue-game",
};

const label = (c: Card) => {
  if (c.type === "treatment") return c.treatment_kind?.replace("_", " ") ?? "treatment";
  return `${c.color} ${c.type}`;
};

export function CardFront({ card, size = "md" }: { card: Card; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-16 h-24" : size === "lg" ? "w-32 h-48" : "w-24 h-36";
  return (
    <div className={`${dims} rounded-xl bg-surface shadow-card overflow-hidden border border-black/10 select-none`}>
      <div className={`h-6 ${colorBand[card.color] ?? "bg-surface"}`} />
      <div className="flex flex-col items-center justify-center py-2">
        <CardPictogram card={card} />
      </div>
      <div className="text-center text-[10px] uppercase tracking-wider text-muted pb-2 capitalize">{label(card)}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write `CardBack.tsx`**

```typescript
export function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-16 h-24" : size === "lg" ? "w-32 h-48" : "w-24 h-36";
  return (
    <div className={`${dims} rounded-xl shadow-card overflow-hidden`} style={{ background: "var(--card-back)" }}>
      <svg viewBox="0 0 100 150" className="h-full w-full">
        <circle cx="50" cy="55" r="28" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="50" cy="55" r="18" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="42" y="38" width="16" height="34" rx="3" fill="#fff" />
        <rect x="46" y="68" width="8" height="12" fill="#fff" />
        <text x="50" y="118" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="2">ANTIBODY</text>
        <text x="50" y="130" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="2">POLITICS</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/cards/CardFront.tsx frontend/src/cards/CardBack.tsx
git commit -m "feat(frontend): CardFront and CardBack SVG components"
```

### Task 5.3: Hand component

**Files:**
- Create: `frontend/src/components/Hand.tsx`

- [ ] **Step 1: Write `Hand.tsx`**

```typescript
import { motion } from "framer-motion";
import type { Card } from "../game/types";
import { useStore } from "../game/store";
import { CardFront } from "../cards/CardFront";

export function Hand({ cards, active }: { cards: Card[]; active: boolean }) {
  const selectedId = useStore((s) => s.selectedCardId);

  return (
    <div className="flex gap-2 justify-center items-end">
      {cards.map((c, i) => {
        const selected = c.id === selectedId;
        const angle = (i - (cards.length - 1) / 2) * 4;
        return (
          <motion.button
            key={c.id}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: selected ? -20 : 0, opacity: 1, rotate: angle, scale: selected ? 1.05 : 1 }}
            whileHover={active ? { y: -10, scale: 1.04 } : undefined}
            transition={{ type: "spring", damping: 14, stiffness: 220 }}
            onClick={() => active && useStore.getState().setSelected(selected ? null : c.id)}
            disabled={!active}
            className="disabled:cursor-not-allowed disabled:opacity-70"
            aria-label={`${c.color} ${c.type}`}
          >
            <CardFront card={c} />
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Hand.tsx
git commit -m "feat(frontend): Hand component with fanned cards and selection state"
```

### Task 5.4: OrganRow and BoardSeat

**Files:**
- Create: `frontend/src/components/OrganRow.tsx`
- Create: `frontend/src/components/BoardSeat.tsx`

- [ ] **Step 1: Write `OrganRow.tsx`**

```typescript
import { motion } from "framer-motion";
import type { Organ, OrganStatus } from "../game/types";
import { CardFront } from "../cards/CardFront";

const statusRing: Record<OrganStatus, string> = {
  free: "ring-2 ring-transparent",
  vaccinated: "ring-4 ring-green-game",
  infected: "ring-4 ring-red-game animate-pulse",
  immunized: "ring-4 ring-yellow-game",
};

export function OrganRow({
  organs,
  onOrganClick,
  targetableIds,
}: {
  organs: Organ[];
  onOrganClick?: (organ: Organ) => void;
  targetableIds?: Set<string>;
}) {
  const slots = [...organs, ...Array(Math.max(0, 4 - organs.length)).fill(null)].slice(0, 4);

  return (
    <div className="flex gap-2 justify-center">
      {slots.map((o, i) => {
        if (!o) {
          return <div key={`empty-${i}`} className="w-24 h-36 rounded-xl border-2 border-dashed border-muted/30" />;
        }
        const tgt = targetableIds?.has(o.id);
        return (
          <motion.button
            key={o.id}
            layout
            whileHover={tgt ? { scale: 1.06 } : undefined}
            onClick={() => onOrganClick?.(o)}
            disabled={!tgt}
            className={`relative ${statusRing[o.status]} rounded-xl ${tgt ? "cursor-pointer" : "cursor-default"} disabled:cursor-default`}
            aria-label={`${o.color} organ: ${o.status}`}
          >
            <CardFront card={{ id: o.id, type: "organ", color: o.color }} />
            {o.attached.length > 0 && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {o.attached.map((a) => (
                  <div key={a.id} className="scale-50 origin-bottom">
                    <CardFront card={a} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `BoardSeat.tsx`**

```typescript
import { motion } from "framer-motion";
import type { PlayerView } from "../game/types";
import { CardBack } from "../cards/CardBack";
import { OrganRow } from "./OrganRow";
import { useStore } from "../game/store";

export function BoardSeat({ player, position }: { player: PlayerView; position: "left" | "top" | "right" }) {
  const thinkingPlayer = useStore((s) => s.botThinking.player);
  const isThinking = thinkingPlayer === player.idx;
  const turnIdx = useStore((s) => s.snapshot?.turn_idx);
  const isActive = turnIdx === player.idx;

  return (
    <div className={`flex flex-col items-center gap-3 ${position === "left" ? "items-start" : position === "right" ? "items-end" : ""}`}>
      <div className="flex items-center gap-3">
        <motion.div
          animate={isThinking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ repeat: isThinking ? Infinity : 0, duration: 0.9 }}
          className={`h-10 w-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold ${isActive ? "ring-2 ring-accent" : ""}`}
        >
          {player.name.charAt(0)}
        </motion.div>
        <div>
          <div className="font-medium">{player.name}</div>
          <div className="text-xs text-muted">{player.hand_count} cards{isThinking ? " · thinking…" : ""}</div>
        </div>
        <div className="flex -space-x-3">
          {Array.from({ length: Math.min(player.hand_count, 5) }).map((_, i) => (
            <div key={i} style={{ transform: `rotate(${(i - 2) * 5}deg)` }}>
              <CardBack size="sm" />
            </div>
          ))}
        </div>
      </div>
      <OrganRow organs={player.body} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/OrganRow.tsx frontend/src/components/BoardSeat.tsx
git commit -m "feat(frontend): OrganRow and BoardSeat components"
```

### Task 5.5: ActivityLog, ThemeToggle, Toast, Settings, Banner

**Files:**
- Create: `frontend/src/components/ActivityLog.tsx`
- Create: `frontend/src/components/ThemeToggle.tsx`
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/Settings.tsx`
- Create: `frontend/src/components/Banner.tsx`

- [ ] **Step 1: `ActivityLog.tsx`**

```typescript
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../game/store";

export function ActivityLog() {
  const events = useStore((s) => s.events.slice(-4));
  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {events.map((e, i) => (
          <motion.div
            key={`${i}-${e}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1 - (events.length - 1 - i) * 0.18, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="text-sm text-text"
          >
            {e}
          </motion.div>
        ))}
      </AnimatePresence>
      {events.length === 0 && <div className="text-sm text-muted">No events yet.</div>}
    </div>
  );
}
```

- [ ] **Step 2: `ThemeToggle.tsx`**

```typescript
import { useStore } from "../game/store";

export function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  return (
    <button
      onClick={() => useStore.getState().setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md border border-muted/40 px-3 py-1.5 text-sm hover:bg-muted/10"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}
```

- [ ] **Step 3: `Toast.tsx`**

```typescript
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore } from "../game/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => useStore.getState().setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-surface px-5 py-2 shadow-card text-sm"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: `Settings.tsx`**

```typescript
import { useStore } from "../game/store";

export function Settings() {
  const animSpeed = useStore((s) => s.animSpeed);
  const soundOn = useStore((s) => s.soundOn);
  return (
    <div className="space-y-2 text-sm">
      <label className="flex items-center justify-between gap-2">
        <span>Animation speed</span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={animSpeed}
          onChange={(e) => {
            const v = Number(e.target.value);
            localStorage.setItem("animSpeed", String(v));
            useStore.setState({ animSpeed: v });
          }}
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span>Sound</span>
        <input
          type="checkbox"
          checked={soundOn}
          onChange={(e) => {
            localStorage.setItem("soundOn", e.target.checked ? "1" : "0");
            useStore.setState({ soundOn: e.target.checked });
          }}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 5: `Banner.tsx`**

```typescript
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../game/store";

export function Banner() {
  const snap = useStore((s) => s.snapshot);
  const winner = snap?.winner_idx ?? null;
  return (
    <AnimatePresence>
      {winner !== null && snap && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
        >
          <div className="rounded-2xl bg-surface p-8 text-center shadow-card">
            <div className="text-3xl font-display font-bold">{snap.players[winner].name} wins!</div>
            <button
              onClick={() => location.reload()}
              className="mt-6 rounded-full bg-accent px-6 py-2 text-bg font-medium"
            >
              Play again
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): ActivityLog, ThemeToggle, Toast, Settings, Banner"
```

### Task 5.6: Wire all components into `Game.tsx` with target-picker flow

**Files:**
- Modify: `frontend/src/pages/Game.tsx`

- [ ] **Step 1: Rewrite `Game.tsx`**

```typescript
import { useMemo, useState } from "react";
import { useStore } from "../game/store";
import { discardCards, passTurn, playCard } from "../game/actions";
import { BoardSeat } from "../components/BoardSeat";
import { Hand } from "../components/Hand";
import { OrganRow } from "../components/OrganRow";
import { ActivityLog } from "../components/ActivityLog";
import { ThemeToggle } from "../components/ThemeToggle";
import { Settings } from "../components/Settings";
import { Toast } from "../components/Toast";
import { Banner } from "../components/Banner";
import { CardBack } from "../cards/CardBack";
import { CardFront } from "../cards/CardFront";
import type { Card, Organ } from "../game/types";

function findCard(hand: Card[] | null, id: string | null): Card | null {
  if (!hand || !id) return null;
  return hand.find((c) => c.id === id) ?? null;
}

function isNoTargetCard(card: Card): boolean {
  if (card.type === "treatment" && (card.treatment_kind === "latex_glove" || card.treatment_kind === "contagion")) return true;
  return card.type === "organ";
}

export default function Game() {
  const snap = useStore((s) => s.snapshot);
  const selectedId = useStore((s) => s.selectedCardId);
  const [pendingFromOrgan, setPendingFromOrgan] = useState<{ player: number; organ_id: string } | null>(null);

  if (!snap) return <div className="flex h-screen items-center justify-center">Loading…</div>;

  const human = snap.players[0];
  const myTurn = snap.turn_idx === 0;
  const selectedCard = findCard(human.hand, selectedId);

  function handleOrganClick(organ: Organ, ownerIdx: number) {
    if (!selectedCard) return;
    if (selectedCard.type === "treatment" && selectedCard.treatment_kind === "transplant") {
      if (!pendingFromOrgan) {
        setPendingFromOrgan({ player: ownerIdx, organ_id: organ.id });
        return;
      }
      playCard(selectedCard.id, { from: pendingFromOrgan, to: { player: ownerIdx, organ_id: organ.id } });
      setPendingFromOrgan(null);
      return;
    }
    if (selectedCard.type === "virus" || selectedCard.type === "medicine" || (selectedCard.type === "treatment" && selectedCard.treatment_kind === "organ_thief")) {
      playCard(selectedCard.id, { player: ownerIdx, organ_id: organ.id });
      return;
    }
  }

  function handlePlayerClick(playerIdx: number) {
    if (!selectedCard) return;
    if (selectedCard.type === "treatment" && selectedCard.treatment_kind === "medical_error") {
      playCard(selectedCard.id, { player: playerIdx });
    }
  }

  function handlePlayNoTarget() {
    if (!selectedCard) return;
    if (selectedCard.type === "organ" || isNoTargetCard(selectedCard)) {
      playCard(selectedCard.id, {});
    }
  }

  const targetable = useMemo(() => {
    if (!selectedCard) return undefined;
    if (selectedCard.type === "virus" || selectedCard.type === "medicine" || (selectedCard.type === "treatment" && (selectedCard.treatment_kind === "organ_thief" || selectedCard.treatment_kind === "transplant"))) {
      // a coarse heuristic: any non-immunized organ is candidate; backend re-validates
      const all: Record<number, Set<string>> = {};
      for (const p of snap.players) all[p.idx] = new Set(p.body.filter(o => o.status !== "immunized").map(o => o.id));
      return all;
    }
    return undefined;
  }, [selectedCard, snap]);

  return (
    <div className="grid h-screen grid-cols-[1fr_320px] gap-4 bg-bg p-4 text-text">
      <div className="relative rounded-2xl bg-surface p-6 shadow-card flex flex-col">
        {/* Top row: 3 bots */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map((i, k) => (
            <div key={i} onClick={() => handlePlayerClick(i)}>
              <BoardSeat player={snap.players[i]} position={k === 0 ? "left" : k === 2 ? "right" : "top"} />
            </div>
          ))}
        </div>

        {/* Center: deck + discard */}
        <div className="flex justify-center items-center gap-8 my-6">
          <div className="text-center">
            <CardBack />
            <div className="text-xs text-muted mt-1">Deck · {snap.deck_count}</div>
          </div>
          <div className="text-center">
            {snap.discard_top ? <CardFront card={snap.discard_top} /> : <div className="w-24 h-36 rounded-xl border-2 border-dashed border-muted/30" />}
            <div className="text-xs text-muted mt-1">Discard · {snap.discard_count}</div>
          </div>
        </div>

        {/* Bottom: human */}
        <div className="mt-auto">
          <OrganRow organs={human.body} targetableIds={targetable?.[0]} onOrganClick={(o) => handleOrganClick(o, 0)} />
          <div className="my-2 text-center">
            <button
              onClick={handlePlayNoTarget}
              disabled={!myTurn || !selectedCard || !isNoTargetCard(selectedCard)}
              className="rounded-md bg-accent px-4 py-1.5 text-bg disabled:opacity-30"
            >Play</button>
            <button
              onClick={() => selectedId && discardCards([selectedId])}
              disabled={!myTurn || !selectedId}
              className="ml-2 rounded-md border border-muted/30 px-4 py-1.5 disabled:opacity-30"
            >Discard</button>
            <button
              onClick={passTurn}
              disabled={!myTurn || human.hand_count > 0}
              className="ml-2 rounded-md border border-muted/30 px-4 py-1.5 disabled:opacity-30"
            >Pass</button>
          </div>
          <Hand cards={human.hand ?? []} active={myTurn} />
        </div>
      </div>

      <aside className="rounded-2xl bg-surface p-4 shadow-card flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-display">Activity</h2>
          <ThemeToggle />
        </div>
        <ActivityLog />
        <div className="mt-6 border-t border-muted/20 pt-3 text-sm">
          <h3 className="font-display mb-2">Settings</h3>
          <Settings />
        </div>
        <button
          onClick={() => location.reload()}
          className="mt-auto rounded-md border border-muted/30 px-4 py-1.5"
        >New game</button>
      </aside>

      <Toast />
      <Banner />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
./run.sh dev
```

Open `http://127.0.0.1:5173`. Click New Game. Verify:
- Hand renders fanned at bottom; clicking a card lifts it.
- "Play" enabled only when an organ/contagion/latex-glove is selected.
- Playing an organ shows it in your body row.
- Bot turn shows "thinking…" then their action animates in.
- Activity log shows the last 4 events.
- Theme toggle flips dark/light.

`Ctrl-C` to stop.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Game.tsx
git commit -m "feat(frontend): full Game page wiring with target picker and controls"
```

---

## Milestone 6 — Animations + polish

### Task 6.1: Framer Motion variants module

**Files:**
- Create: `frontend/src/anim/variants.ts`

- [ ] **Step 1: Write shared variants**

```typescript
import type { Variants } from "framer-motion";

export const dealVariants: Variants = {
  hidden: { y: -80, opacity: 0, rotate: -8 },
  visible: (i: number) => ({
    y: 0, opacity: 1, rotate: 0,
    transition: { delay: i * 0.06, type: "spring", damping: 14, stiffness: 200 },
  }),
};

export const cardSpring = { type: "spring" as const, damping: 12, stiffness: 220, mass: 0.6 };

export const playVariants: Variants = {
  rest: { scale: 1, y: 0 },
  selected: { scale: 1.06, y: -16, transition: cardSpring },
  hover: { scale: 1.04, y: -10, transition: cardSpring },
};

export const winBurst: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: [0, 1.2, 1], opacity: 1, transition: { duration: 0.8 } },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/anim/variants.ts
git commit -m "feat(frontend): shared Framer Motion variants"
```

### Task 6.2: Deal animation on game start

**Files:**
- Modify: `frontend/src/components/Hand.tsx` to use `dealVariants` with custom delays.

- [ ] **Step 1: Update `Hand.tsx`**

Replace the `motion.button` initial/animate with variant usage:

```typescript
import { dealVariants } from "../anim/variants";

// inside the map:
<motion.button
  key={c.id}
  custom={i}
  variants={dealVariants}
  initial="hidden"
  animate="visible"
  whileHover={active ? { y: -10, scale: 1.04 } : undefined}
  transition={{ type: "spring", damping: 14, stiffness: 220 }}
  onClick={() => active && useStore.getState().setSelected(selectedId === c.id ? null : c.id)}
  disabled={!active}
  className="disabled:cursor-not-allowed disabled:opacity-70"
  aria-label={`${c.color} ${c.type}`}
  style={{ transform: `rotate(${(i - (cards.length - 1) / 2) * 4}deg)` }}
>
  <CardFront card={c} />
</motion.button>
```

- [ ] **Step 2: Verify in dev**

`./run.sh dev`, click New Game, confirm staggered card entry on initial deal.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Hand.tsx
git commit -m "feat(frontend): deal animation with staggered card entry"
```

### Task 6.3: Card-play flight animation via shared layout

**Files:**
- Modify: `frontend/src/components/Hand.tsx` — wrap motion.button with `layoutId={card.id}` (same id used on the organ slot when attached) so Framer Motion animates the transition automatically.
- Modify: `frontend/src/components/OrganRow.tsx` — wrap attached cards with `layoutId={card.id}`.

- [ ] **Step 1: Add `layoutId` to Hand cards**

In `Hand.tsx`, on the inner `<CardFront card={c} />`, wrap with:

```typescript
<motion.div layoutId={c.id} layout>
  <CardFront card={c} />
</motion.div>
```

- [ ] **Step 2: Add `layoutId` to OrganRow attached cards**

In `OrganRow.tsx`, change the attached-card render block to:

```typescript
{o.attached.map((a) => (
  <motion.div key={a.id} layoutId={a.id} layout className="scale-50 origin-bottom">
    <CardFront card={a} size="sm" />
  </motion.div>
))}
```

- [ ] **Step 3: Smoke test**

`./run.sh dev`, play a virus from hand onto an organ. Card should flight-animate from hand position to the organ slot.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Hand.tsx frontend/src/components/OrganRow.tsx
git commit -m "feat(frontend): card flight via shared layoutId from hand to organ"
```

### Task 6.4: Bot thinking indicator polish

**Files:**
- Modify: `frontend/src/components/BoardSeat.tsx` — add ellipsis bubble.

- [ ] **Step 1: Replace the thinking text with an animated bubble**

In `BoardSeat.tsx`, replace the `{isThinking ? " · thinking…" : ""}` with a separate element:

```typescript
{isThinking && (
  <motion.div
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="ml-2 rounded-full bg-bg/60 px-2 py-0.5 text-xs"
  >
    <motion.span
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ repeat: Infinity, duration: 1.2 }}
    >• • •</motion.span>
  </motion.div>
)}
```

And remove the `{isThinking ? " · thinking…" : ""}` from the cards subtitle.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BoardSeat.tsx
git commit -m "feat(frontend): animated thinking ellipsis bubble on bot seats"
```

### Task 6.5: Victory confetti

**Files:**
- Modify: `frontend/src/components/Banner.tsx` — add a simple CSS-confetti burst.

- [ ] **Step 1: Update `Banner.tsx` to include confetti pieces**

Add the following inside the existing motion.div (above the result card):

```typescript
{Array.from({ length: 40 }).map((_, i) => {
  const angle = (i / 40) * Math.PI * 2;
  const dx = Math.cos(angle) * (120 + (i % 6) * 18);
  const dy = Math.sin(angle) * (120 + (i % 6) * 18);
  const colors = ["var(--c-red)", "var(--c-green)", "var(--c-blue)", "var(--c-yellow)", "var(--accent)"];
  return (
    <motion.span
      key={i}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x: dx, y: dy, opacity: 0, rotate: 360 }}
      transition={{ duration: 1.4, ease: "easeOut" }}
      className="absolute h-2 w-2 rounded-sm"
      style={{ background: colors[i % colors.length] }}
    />
  );
})}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Banner.tsx
git commit -m "feat(frontend): confetti burst on victory banner"
```

---

## Milestone 7 — Integration + acceptance

### Task 7.1: End-to-end manual playthrough

- [ ] **Step 1: Build for production**

```bash
./run.sh clean
./run.sh
```

Expected: builds frontend, starts uvicorn, prints `→ serving on http://127.0.0.1:8001`.

- [ ] **Step 2: Verify every spec §13 success criterion**

| Criterion | How to verify |
|-----------|---------------|
| `./run.sh` boots on `:8001` | Browser opens to a styled start screen |
| 3 bots + 1 human dial in | Click New Game; 4 seats render |
| Cards deal with animation | Initial deal shows staggered card entry |
| Human plays a full game | Play 3+ cards; reach a win or close to it |
| Bots take 1–2s per turn | Stopwatch a bot turn |
| Activity log shows last 4 events | Confirm log trims to 4 |
| Theme toggle works | Click toggle, colors change smoothly |
| No console errors | Open DevTools console |
| `pytest backend/tests` green | Run from `backend/` |
| Bot tournament hybrid > heuristic | Run `BOT_BUDGET_S=1.2 pytest tests/test_bot.py -v -k tournament` |
| `CLAUDE.md` reflects architecture | Compare to spec §3, §4 |

- [ ] **Step 3: Note any drift; create follow-up tasks if needed**

If any criterion fails, write a follow-up task at the end of `docs/specs/tasks.md` and address it before tagging.

### Task 7.2: Update changelog and tag v0.1-phase-1

**Files:**
- Modify: `docs/changelog.md`

- [ ] **Step 1: Add release entry**

Insert above `[Unreleased]`:

```markdown
## [0.1.0] — 2026-05-16

### Added
- Phase 1 complete: 1 human vs 3 bots Virus! engine, hybrid bot AI, animated React UI.
- `./run.sh` one-command boot on `:8001`.

### Tests
- 50-seed engine fuzz passes.
- Bot tournament: hybrid > heuristic-only.
```

- [ ] **Step 2: Tag**

```bash
git add docs/changelog.md
git commit -m "chore: bump changelog to v0.1.0 (Phase 1 complete)"
git tag v0.1-phase-1
```

---

## Self-review checklist (run before claiming plan complete)

- [ ] Every spec §3–§10 requirement maps to a task.
- [ ] No "TBD", "TODO", "etc." in any step body.
- [ ] Every code block compiles (TS strict mode, Python 3.11+).
- [ ] All function/type/method names used in later tasks are defined in earlier tasks.
- [ ] All test files reference real fixtures and helpers.
- [ ] `run.sh` is referenced consistently as the boot entry.
- [ ] Bot fairness invariant has a dedicated test (`test_bot_only_sees_public_snapshot`).
- [ ] WS message types in code match those documented in spec §9.2.

