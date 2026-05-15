# Antibody Politics — Design Spec

- **Status:** approved
- **Last updated:** 2026-05-16
- **Companion docs:** [`decisions.md`](decisions.md) · [`tasks.md`](tasks.md) · [`../changelog.md`](../changelog.md)

## 1. Overview

Antibody Politics is a digital implementation of the Spanish card game **Virus!** (Tranjis Games). Players race to assemble a healthy body of four distinct-colored organs while attacking opponents with viruses and treatments.

- **Phase 1 (this spec):** Single-player web app — 1 human vs 3 bots, local single-process FastAPI server, in-memory state.
- **Phase 2 (future):** Online multiplayer — 4 humans per room, lobbies, reconnect, Redis-backed state. Out of scope here, but architecture must not preclude it.

## 2. Goals & non-goals

**Goals**
- Faithful implementation of Virus! rules with deterministic, replayable randomness.
- Polished, animated UI matching the visual feel of the reference image (`sources/ui_design_sample.png`).
- Bots that beat casual humans and challenge experienced ones, using only public information.
- One-command boot via `./run.sh` on `127.0.0.1:8001`.
- Engine, bot, and frontend layers each understandable and testable in isolation.

**Non-goals (Phase 1)**
- Online multiplayer, accounts, persistence, matchmaking.
- Chat, emotes, social features.
- Mobile-native apps (web only; mobile-responsive layout is enough).
- Localization beyond English.
- Sound design beyond a few cue effects.

## 3. High-level architecture

```
┌──────────────────────────┐        WS /ws/games/{id}      ┌──────────────────────────┐
│ React 18 + Vite + TS     │ ◀──── snapshot / events ────▶ │ FastAPI + Pydantic v2    │
│ Tailwind + Framer Motion │                               │ Layered engine (pure)    │
│ Zustand store            │       POST /api/games         │ InMemoryStore            │
└──────────────────────────┘ ────── create / restart ────▶ │ HybridBot (heur + MCTS)  │
                                                          └──────────────────────────┘
        served by FastAPI                                  127.0.0.1:8001
        from frontend/dist
        (prod mode)
```

- **Backend:** FastAPI, Python 3.11+, uvicorn, Pydantic v2. Single process for Phase 1.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + Framer Motion + Zustand. Built to `frontend/dist/` and served as static by FastAPI in production.
- **Communication:** WebSocket-first. One channel per game; HTTP only for `POST /api/games`.
- **State:** In-memory `Dict[game_id, GameState]` behind a `GameStore` protocol so Phase 2 can swap to Redis.

## 4. Repo layout

```
backend/
  app/
    models.py        # Pydantic models + enums
    deck.py          # 68-card canonical deck, shuffle/reshuffle
    rules.py         # Pure rule functions: apply_play, legal_targets
    game.py          # Turn loop orchestration
    bot.py           # Hybrid policy: heuristics + MCTS-lite
    snapshot.py      # public_snapshot(state, viewer_idx)
    store.py         # GameStore protocol + InMemoryStore
    ws.py            # WebSocket gateway + event router
    main.py          # FastAPI app + HTTP routes + lifespan
  tests/
    test_rules.py
    test_engine.py
    test_bot.py
  requirements.txt
  venv/              # local virtualenv (gitignored)

frontend/
  src/
    components/      # Hand, Organ, BoardSeat, ActivityLog, ThemeToggle, ...
    game/            # zustand store, ws client, action dispatchers, types
    anim/            # Framer Motion variants, deal/play/discard choreography
    cards/           # procedural SVG card renderer
    styles/          # Tailwind config, theme tokens
    pages/           # Game.tsx, NewGame.tsx
    main.tsx, App.tsx
  index.html, vite.config.ts, tailwind.config.ts, tsconfig.json, package.json

docs/
  specs/
    spec.md          # this file
    decisions.md     # ADR-style architectural decisions
    tasks.md         # living task roadmap (detailed plan lives elsewhere)
  changelog.md       # Keep-a-Changelog format

run.sh               # one-command boot on :8001
README.md
CLAUDE.md            # working principles + pointer to docs/specs/
```

## 5. `run.sh` behavior

| Invocation       | Behavior                                                                                                                              |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `./run.sh`       | **Production-ish mode.** Bootstraps venv + npm deps if missing. Builds `frontend/dist` if stale. Starts uvicorn on `127.0.0.1:8001`, FastAPI serves `frontend/dist` as static + API + WS. One URL, one port. |
| `./run.sh dev`   | **Dev mode.** Same bootstrap. Starts uvicorn with `--reload` on `:8001` *and* Vite dev server on `:5173` with `/api` + `/ws` proxied to `:8001`. Opens `:5173` for HMR.                                       |
| `./run.sh clean` | Removes `backend/venv`, `frontend/node_modules`, `frontend/dist`. Forces fresh bootstrap on next run.                                   |

The script is idempotent and prints exactly which port to open.

## 6. Game engine

### 6.1 Models (`backend/app/models.py`)

```
Color        = RED | GREEN | BLUE | YELLOW | MULTI
CardType     = ORGAN | VIRUS | MEDICINE | TREATMENT
TreatmentKind = TRANSPLANT | ORGAN_THIEF | CONTAGION | LATEX_GLOVE | MEDICAL_ERROR
OrganStatus  = FREE | VACCINATED | INFECTED | IMMUNIZED   # DESTROYED = removed from body

Card   { id, type, color, treatment_kind? }
Organ  { id, color, attached: list[Card], status: OrganStatus  ← computed property }
Player { idx, name, is_bot, hand: list[Card], body: list[Organ] }
GameState { players: list[Player], deck, discard, turn_idx, winner_idx, event_log, seed, rng_state }
```

**Computed `Organ.status`** — derived from `attached` every read:
- 0 cards: `FREE`
- 1 virus: `INFECTED`
- 1 medicine: `VACCINATED`
- 2 medicines (matching color or MULTI involved): `IMMUNIZED` (permanent — cannot be infected, transplanted, stolen, or contagion-targeted)
- 2 viruses: destroyed during `apply_play` (organ removed from `body`, both viruses + organ go to discard); never a status

**Win condition** — `Player.has_won()`:
- Body contains 4 organs all `FREE | VACCINATED | IMMUNIZED`.
- Colors are distinct. A MULTI organ counts as the missing color (deck contains exactly one MULTI organ, so at most one assist).

### 6.2 Deck (`backend/app/deck.py`)

Canonical 68-card composition per the official Tranjis Virus! rules:

| Kind        | RED | GREEN | BLUE | YELLOW | MULTI | Total |
|-------------|-----|-------|------|--------|-------|-------|
| Organs      | 5   | 5     | 5    | 5      | 1     | 21    |
| Viruses     | 4   | 4     | 4    | 4      | 1     | 17    |
| Medicines   | 4   | 4     | 4    | 4      | 4     | 20    |
| Treatments  | —   | —     | —    | —      | —     | 10    |

Treatments breakdown: 3 Transplant, 1 Organ Thief, 2 Contagion, 1 Latex Glove, 3 Medical Error. *(Exact counts to be verified against the official rulebook during implementation; the spec covers the 5 treatment kinds and the 68-card total.)*

Reshuffle policy: when the deck is empty, shuffle the discard pile (minus the top card if used as a marker — we do not use a top-card marker, so the whole discard pile is shuffled into the new deck).

Randomness: a single `random.Random(seed)` per game, seed logged to `GameState.seed`. Bots use a separate RNG to keep deal randomness independent of bot choices.

### 6.3 Rules (`backend/app/rules.py`)

The **only** module that mutates organs or hands. `game.py` calls into it but never reaches into `Player.body` or `Player.hand` itself.

**Public API:**
- `apply_play(state, player_idx, card_id, targets) → list[str]` — execute one card, mutate state, return human-readable event strings for the activity log. Raises `IllegalAction` on illegal plays.
- `legal_targets(state, player_idx, card) → list[dict]` — enumerate every legal `targets` dict. `[{}]` for no-target cards. `[]` if the card is unplayable from this state.

`targets` shape examples:
- Play ORGAN: `{}`
- Play VIRUS / MEDICINE: `{ "player": int, "organ_id": str }`
- Play TRANSPLANT: `{ "from": {"player": int, "organ_id": str}, "to": {"player": int, "organ_id": str} }`
- Play ORGAN_THIEF: `{ "player": int, "organ_id": str }`
- Play CONTAGION: `{}` (auto-targets — engine resolves which viruses transfer to whose matching healthy organs)
- Play LATEX_GLOVE: `{}`
- Play MEDICAL_ERROR: `{ "player": int }`

Color matching: MULTI cards match any color; a MULTI organ accepts any-color virus/medicine.

### 6.4 Turn loop (`backend/app/game.py`)

Each turn the active player chooses exactly one of:
- `play_card(state, idx, card_id, targets)` → calls `rules.apply_play`, then `check_winner`, then `end_turn_draw` (refill hand to 3), then `advance_turn`.
- `discard_cards(state, idx, card_ids)` → discard 1–3 cards, no draw this turn (Virus! rule), then `advance_turn`.
- `pass_turn(state, idx)` → only legal when hand is empty (rare; usually happens to bots mid-game via Latex Glove).

`check_winner` short-circuits the loop; once `winner_idx` is set, no further plays accepted.

### 6.5 Snapshot (`backend/app/snapshot.py`)

`public_snapshot(state, viewer_idx) → dict` is the **only** shape leaving the server. Same shape for human and bots:

```
{
  "game_id": str,
  "viewer_idx": int,
  "turn_idx": int,
  "winner_idx": int | None,
  "deck_count": int,
  "discard_count": int,
  "discard_top": Card | None,
  "event_log": list[str],   # last 50 events; client trims to last 4 for display
  "players": [
    {
      "idx": int, "name": str, "is_bot": bool,
      "hand": list[Card] | None,   # populated only if idx == viewer_idx
      "hand_count": int,
      "body": list[Organ]
    },
    ...
  ]
}
```

Hidden info: other players' hand contents, the deck order. Bots receive this same snapshot — they cannot see hidden info. **A unit test asserts `bot.choose_action` raises if given a state with another player's hand visible.**

## 7. Bot AI

### 7.1 Two-layer policy

```
bot.choose_action(snapshot, my_seat) → (kind, payload):

  1. Enumerate all legal actions: every (play, card_id, targets), plus discard combinations, plus pass.
  2. heuristic_score(action) for each → ranked list.
  3. If high-stakes trigger fires: run MCTS-lite within ~1s budget, rerank top-K candidates.
  4. Return the winning action.
```

### 7.2 Heuristic scorer

Weighted features (weights tuned empirically via bot-vs-bot tournaments):

| Feature                                                    | Direction | Notes                                                              |
|------------------------------------------------------------|-----------|--------------------------------------------------------------------|
| Own organ near win (3/4 distinct colors)                   | protect   | Heavy weight on healing/immunizing                                 |
| Leader (closest to 4) at 3/4                               | attack    | Prefer destructive plays on leader's organs                        |
| Stack 2nd medicine on vaccinated organ                     | setup     | Permanent immunity — huge defensive value                          |
| Discard off-color medicines with no body match             | tempo     | Free up hand                                                       |
| MULTI cards in hand                                        | flex      | Slight bonus to *keep* MULTI cards                                 |
| Transplant/Organ Thief into colors you cannot defend       | risk      | Penalty                                                            |
| Contagion when you have ≥2 viruses on board                | swing     | Bonus when matching opponent organs are healthy                    |
| Medical Error when opponent has 3 immunized organs         | desperate | Strongly bonus when you're behind and they're one organ from win   |

### 7.3 MCTS-lite overlay

**Trigger conditions** (any one fires):
- Any player is one organ from winning.
- Action is a Treatment (Transplant / Contagion / Medical Error / Organ Thief).
- Top-2 heuristic actions are within 10% of each other.

**Procedure** (1.0s compute budget — total perceived think time is 1.0–2.0s):
1. Compute unseen-cards pool from public info: `full_deck − visible_cards (organs, viruses, medicines, treatments on bodies + own hand + discard pile)`.
2. For each candidate action in heuristic top-3:
   - For ~200–500 rollouts (capped by elapsed time):
     - Deal a determinized hand of correct size to each opponent from the unseen pool.
     - Apply the candidate action.
     - Continue the game with all players using **fast heuristic-only policies** until a winner emerges or 20 plies elapse (draw → 0).
     - Score: `+1` self win, `−1` any opponent win, `0` draw/timeout.
   - Average the score.
3. Pick the action with the highest mean. Heuristic score breaks ties.

**Computational note.** Rollouts share a `RolloutState` that uses lightweight slot-arrays instead of Pydantic models for speed; conversion happens once at the start of each rollout. Target: ≥200 rollouts per candidate on a modest laptop within budget.

### 7.4 Fairness invariants

- `bot.choose_action(snapshot, my_seat)` accepts only the public snapshot shape.
- Unseen-cards pool is reconstructed from public info; never reads `state.deck` directly.
- Unit test: feed a tampered snapshot with another player's hand visible → bot must raise.

### 7.5 Think delay UX

```
WS event sequence on bot turn:
  → { "type": "bot_thinking", "player": idx, "expected_ms": 1500 }
  ... server computes (real work) ...
  ... server waits until at least 1000ms elapsed since the event ...
  → { "type": "action", "player": idx, "kind": "play|discard|pass", "events": [...], "snapshot": {...} }
```

So decisions feel deliberate even when the bot is fast, and the user sees a smooth pulse on the bot's avatar throughout.

## 8. Frontend

### 8.1 Layout

Reference image: `sources/ui_design_sample.png`. Adaptations:

- **Center table** — deck (left) + discard pile (right), with count badges; subtle table-felt texture; soft ambient glow.
- **Three bot seats** — top-left, top-center, top-right, arranged around the table. Each shows:
  - Circular avatar with name and seat color
  - Hand-count chip (face-down card icon × N)
  - Organ row: up to 4 slots showing organs and their attached cards
  - Thinking indicator: pulsing ring + "…" speech bubble while `bot_thinking`
- **Human seat (bottom)** — full hand fanned (face-up, with hover-lift), body organ row directly above, action affordances (Play / Discard / Pass) appear contextually after a card is selected.
- **Right side panel** — activity log (last 4 events, oldest fading out top), theme toggle, settings (sound on/off, animation speed slider), "New Game" button. Collapsible on narrow viewports.
- **Toast strip** — transient events (organ destroyed, immunized, stolen) appear as floating cards near the affected seat.

### 8.2 Card design

Reference: `sources/card_design_sample.png`. Procedurally rendered as styled SVG (no PNG assets), so theme + state can re-skin live.

- **Back:** deep red field, concentric white ring, syringe pictogram, "ANTIBODY POLITICS" wordmark at bottom.
- **Front:**
  - Top band: color stripe (RED / GREEN / BLUE / YELLOW / rainbow for MULTI)
  - Center: pictogram (organ silhouette / virus blob / pill / treatment icon)
  - Bottom band: card name + small kind icon
- **State overlays:**
  - Infected: red pulse glow
  - Vaccinated: green halo
  - Immunized: shimmering gold border (looped subtle keyframe)
  - Selected: lift + scale 1.04 + drop shadow
  - Targetable: dotted outline + cursor pointer
  - Invalid target: red shake on hover

### 8.3 Animations (Framer Motion + CSS 3D)

- **Deal (game start):** cards arc from deck to each seat with 60ms stagger. End orientation: face-down for bots, face-up for human.
- **Play card:** card lifts from hand (scale 1.08, z-translate), rotates to face-up, flies to target organ slot along a Bezier path, lands with elastic spring (mass 0.6, damping 12).
- **Discard:** card rotates 12° while arcing to the discard pile, fades to 70% opacity, lands.
- **Draw:** card flies from deck to hand position with slight curl.
- **Bot thinking:** seat avatar pulses (1.0 → 1.05 → 1.0 over 800ms), "…" speech bubble fades in, deck pile gets a subtle shuffle wiggle.
- **Win:** confetti burst centered on winner's seat, other seats dim to 60% brightness, "Victory!" banner slides in.
- **Theme transition:** 250ms color-token cross-fade via CSS custom properties.

All animations respect `prefers-reduced-motion` (instant transitions instead).

### 8.4 State management

Zustand store, slices:

```
{
  connection: { ws: WebSocket | null, status: 'idle' | 'connecting' | 'open' | 'closed' },
  game: { id: string | null, snapshot: Snapshot | null, history: Snapshot[] (last 4) },
  ui:   { selectedCardId, pendingTargets, hoveredOrganId, theme, animSpeed, soundOn },
  bot:  { thinkingPlayerIdx: number | null, thinkingSince: number },
}
```

WS messages are reduced into the store. Components subscribe to slices via Zustand selectors. **No optimistic updates** — server is authoritative; the UI always renders the last snapshot.

### 8.5 Theme

- CSS custom properties for all colors (`--bg`, `--surface`, `--accent`, `--text`, `--card-back`, etc.).
- Two themes: `light` and `dark`. Stored in `localStorage`. Default: dark (matches reference image).
- Theme toggle smoothly cross-fades the root via a 250ms transition on all `color` / `background` / `border-color` properties.

## 9. API surface

### 9.1 HTTP

| Method | Path                     | Purpose                                             |
|--------|--------------------------|-----------------------------------------------------|
| POST   | `/api/games`             | Create a game. Body: `{seed?: int, names?: [str×4]}`. Returns `{game_id, ws_url, snapshot}`. |
| GET    | `/api/games/{id}/snapshot` | Fetch current snapshot (useful for reconnect or initial render after page reload).         |
| GET    | `/api/health`            | Liveness probe.                                     |
| GET    | `/`                      | (Prod mode only) serves `frontend/dist/index.html`. |
| GET    | `/assets/*`              | (Prod mode only) static frontend assets.            |

### 9.2 WebSocket — `/ws/games/{id}`

**Server → client events:**

| Type            | Payload                                                                     |
|-----------------|-----------------------------------------------------------------------------|
| `snapshot`      | `{ snapshot }` — full state push, sent on connect and after any state change |
| `bot_thinking`  | `{ player, expected_ms }`                                                   |
| `action`        | `{ player, kind, events, snapshot }`                                        |
| `game_over`     | `{ winner_idx, snapshot }`                                                  |
| `error`         | `{ code, message }`                                                         |

**Client → server messages:**

| Type      | Payload                                  |
|-----------|------------------------------------------|
| `play`    | `{ card_id, targets }`                   |
| `discard` | `{ card_ids: [str] }` (1–3 cards)        |
| `pass`    | `{}`                                     |

Server validates the active turn belongs to `viewer_idx`. Invalid messages → `error` event, connection stays open.

## 10. Testing strategy

- **Backend unit:** `pytest backend/tests/test_rules.py` — every card type × every legal/illegal target combination. Specific edge cases:
  - Immunized organ blocks virus, transplant, organ thief, contagion.
  - 2nd virus on infected organ destroys it (organ + both viruses to discard).
  - 2nd medicine on vaccinated organ immunizes (permanent).
  - MULTI organ accepts any color virus/medicine, but two MULTIs on a body never happen (only one MULTI organ in the deck).
  - Medical Error swaps full bodies including immunized organs.
- **Backend integration:** `test_engine.py` runs 1000 random-policy games from random seeds — assert no exceptions, every game terminates within 200 turns, exactly one winner.
- **Bot:** `test_bot.py` — bot-vs-bot tournament, 100 games of hybrid-vs-heuristic-only. Assert hybrid win rate ≥ 55%. Fairness assertion: tampered snapshot causes raise.
- **Frontend:** `vitest` for store reducers and pure helpers (target picker logic, win-condition display). Manual smoke for UI in Phase 1; Playwright deferred to Phase 2.
- **Seed replay:** Any reported bug can be reproduced by calling `POST /api/games {seed: X}` — the seed is logged in every snapshot.

## 11. Working principles (carried from prior `CLAUDE.md`)

### 11.1 Think before coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.

### 11.2 Simplicity first
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

### 11.3 Surgical changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style.
- Remove imports/variables/functions that your changes made unused; leave pre-existing dead code alone unless asked.

### 11.4 Goal-driven execution
Define success criteria. Loop until verified.
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."

## 12. Open questions / deferred to Phase 2

- **Auth model.** Likely magic-link or anonymous-with-session-token. Not decided.
- **Reconnect semantics.** Phase 2: how long does a seat stay reserved if a human disconnects mid-game? Default proposal: 60s grace, then a bot takes over.
- **Spectator mode.** Phase 2 nice-to-have. Out of scope for Phase 1.
- **Sound design.** Phase 1 ships a minimal cue set (deal, play, win); fuller sound design deferred.

## 13. Success criteria (Phase 1 done)

- `./run.sh` boots the app on `127.0.0.1:8001`. Browser shows the start screen.
- New Game dials in 3 bots + 1 human. Cards deal with animation. Human plays a full game.
- Bots take 1–2s per turn with visible "thinking" indicator. Bot decisions feel reasonable to a Virus! player.
- Activity log shows last 4 events. Theme toggle works. No console errors.
- `pytest backend/tests` is green. Bot tournament shows hybrid > heuristic-only.
- New `CLAUDE.md` reflects this architecture and links to `docs/specs/spec.md`.
