# Mobile-Responsive Web UI — Design

**Date:** 2026-05-18
**Scope:** Make the in-browser Virus! game playable on smartphone browsers (portrait orientation).
**Out of scope:** Native mobile apps, landscape-specific layout, tablet-specific tuning, PWA install flow, offline mode.

---

## Goal

The game currently renders well only on desktop viewports (≥ ~1024px wide). On a phone the fixed two-column grid (`grid-cols-[1fr_280px]`), the fanned hand with negative margins, and the desktop-sized bot seats collapse into an unreadable, unplayable mess.

This spec defines a phone-portrait layout that keeps **visibility** (all 4 seats, deck/discard, hand, and the turn indicator visible at once) and **thumb-reachable** controls, while preserving the existing desktop layout untouched above the breakpoint.

## Success criteria

A user on iPhone SE (375×667), iPhone 14 Pro (393×852), and Pixel 7 (412×915), held in portrait, can:

1. See all 3 bot opponents (avatar, name, organ row, hand count) without scrolling.
2. See their own organ row and full hand.
3. See deck count, discard top card, and whose-turn indicator.
4. Select a card with a single tap; selected card visibly enlarges and gains the selection ring/badge.
5. Play (target a no-target card), discard (1–3 cards), and target a bot's organ via tap.
6. Open a bottom-sheet drawer to access Activity log, scoreboard, How-to-play, Settings, and NEW GAME.
7. Use the game with no page-level horizontal scroll, no clipped content, no off-screen action buttons.

No regression on desktop (≥ 768px): existing layout, animations, and interactions unchanged.

---

## Approach

**Single `Game.tsx` with Tailwind `md:` breakpoint at 768px + a `useMediaQuery` hook.**

- CSS classes (Tailwind responsive prefixes) drive pure layout differences.
- A new `useMediaQuery('(max-width: 767px)')` hook returns `isMobile: boolean` for components that need different *render trees* (not just different CSS) — specifically `Hand` (fan vs. scroll strip) and `BoardSeat` (full vs. compact variant).
- One source of truth for state, handlers, and game logic; only presentation forks.

Rejected alternatives:

- **Separate `MobileGame.tsx` / `DesktopGame.tsx`** — duplicates handler wiring; high drift risk.
- **Container queries** — over-engineered for a single breakpoint and inconsistent across our target browsers.

---

## Breakpoint

- **Mobile portrait:** `width < 768px` (Tailwind default for `md` breakpoint).
- **Desktop / tablet / landscape:** `width ≥ 768px` — existing layout, unchanged.

A landscape phone narrower than 768px in height but wider than 768px in width gets the desktop layout. That is acceptable: the current desktop layout already adapts via `vh`-based clamps.

---

## Layout (mobile portrait)

Top → bottom inside `h-screen w-screen flex flex-col` on a felt background:

| Zone               | Approx. height | Contents                                                                 |
| ------------------ | -------------- | ------------------------------------------------------------------------ |
| Top app bar        | 44px           | `VIRUS!` title (left), turn pill (center), `☰` menu button (right)       |
| Bot row            | ~18vh          | 3 compact `BoardSeat`s, equal `flex-1`, horizontally side-by-side        |
| Deck/discard band  | ~10vh          | Centered pill with deck mini-card + discard top mini-card, with counts   |
| Human organ row    | ~14vh          | `OrganRow` for human; horizontally scrollable if > 4 organs              |
| Hand strip         | ~28vh          | Horizontal scroll, no fan, cards `clamp(95px, 14vh, 120px)` tall         |
| Action bar         | ~10vh          | `PLAY` + `DISCARD` buttons, full-width side-by-side, ≥ 48px tall         |

Existing `<aside>` side panel is `hidden md:flex`. Its content moves to the bottom-sheet drawer.

The turn pill currently floats absolute on the felt; on mobile it lives inside the top app bar (center slot) so it does not overlap the bot row.

---

## Components

### `useMediaQuery` hook (new — `frontend/src/game/useMediaQuery.ts`)

```ts
export function useMediaQuery(query: string): boolean
```

- Subscribes to `window.matchMedia(query)`.
- Returns boolean.
- SSR-safe default `false` (the app is CSR-only, but the guard keeps it simple).
- Used as `const isMobile = useMediaQuery('(max-width: 767px)')`.

### `Game.tsx` (modified)

- Reads `isMobile`.
- Renders mobile stack OR desktop grid based on `isMobile`.
- Mobile branch: new flex-column layout described above.
- Desktop branch: unchanged (current code path).
- Shared: state hooks, handlers (`handleOrganClick`, `handlePlayerClick`, `handlePlay`, `handleDiscard`), auto-pass effect, `targetable` memo, derived booleans.

### `Hand.tsx` (modified)

Add an `isMobile` branch at the top of the component:

```ts
if (isMobile) return <HandMobile cards={cards} active={active} />;
```

`HandMobile`:

- `flex flex-row gap-2 overflow-x-auto snap-x snap-mandatory px-3 pb-3`.
- Each card wrapped in a button with `snap-center`, no overlap, no rotation.
- Card size: `clamp(95px, 14vh, 120px)` tall (preserves aspect ratio via `CardFront`).
- Tap → `toggleSelect(id)` (existing store action). Selection cap of 3 is enforced server-side and already reflected in the store; mobile inherits it.
- Selected state: `scale: 1.08`, accent ring via `box-shadow: 0 0 0 3px var(--accent)`, plus the existing selection-number badge.
- Disabled when `!active`: 60% opacity, `cursor-not-allowed`.
- No hover lift; mobile has no hover. Hover lift in the desktop `HandCard` is preserved.

### `BoardSeat.tsx` (modified)

Add prop `compact?: boolean` (default `false`).

When `compact`:

- Container `flex-col items-center gap-1 px-2 py-1.5 flex-1 min-w-0`.
- Avatar 28px.
- Name truncated (`truncate` + `max-w-[8ch]`), `font-display text-[11px]`.
- Hand-count badge: small pill at top-right of avatar (`absolute -top-1 -right-1`) showing the number; the "X cards" text and the fanned card-backs row are hidden in compact mode (they don't fit and the badge conveys the same info).
- `OrganRow` size: `clamp(40px, 7vh, 56px)`.
- `align` prop is ignored — compact seats are always center-stacked.
- "Thinking…" indicator remains (small dot under the avatar).
- Active-turn ring and accent shadow remain.
- Player-target tap area: the avatar circle (organ taps handled by `OrganRow`). Both have `min-h-[44px] min-w-[44px]` hit areas (achieved via padding) for thumb safety.

Desktop usage of `BoardSeat` (without `compact`) is unchanged.

### `MobileMenu.tsx` (new — `frontend/src/components/MobileMenu.tsx`)

Bottom-sheet drawer.

- Props: `open: boolean`, `onClose: () => void`.
- Trigger lives in `Game.tsx` top app bar (`☰` button).
- Backdrop: `fixed inset-0 bg-black/50 z-40`, dismisses on tap.
- Sheet: `fixed bottom-0 inset-x-0 max-h-[85vh] rounded-t-2xl z-50`, slides via Framer Motion `initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}` with a spring transition.
- Drag-to-dismiss is *not* in scope (keep it tap-only to ship). Note for a follow-up if requested.
- Content (top to bottom, scroll within sheet):
  - Scoreboard grid (same component used in desktop `<aside>`).
  - `ActivityLog` (with `max-h-[40vh]` scroll container).
  - How-to-play `<details>`.
  - `Settings`.
  - `NEW GAME` button — tapping it triggers `location.reload()` (same as desktop) and the sheet closes implicitly.

### `index.html` (modified)

Replace:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

with:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

`viewport-fit=cover` lets us account for iOS safe areas (notch / home indicator). The action bar uses `padding-bottom: env(safe-area-inset-bottom)` so the DISCARD button is not eaten by the home indicator on iPhones.

### `styles/index.css` (touched lightly)

- Add a `.no-overscroll` utility (`overscroll-behavior: contain`) applied to the hand strip and the bottom sheet, so horizontal swiping inside the hand doesn't trigger the browser's pull-to-refresh.
- Ensure `body { overflow: hidden }` on mobile (it already is via `h-screen w-screen overflow-hidden` on the root, but worth confirming during implementation).

---

## Interactions

| Action                          | Mobile gesture                                            |
| ------------------------------- | --------------------------------------------------------- |
| Select a card                   | Tap card in hand strip                                    |
| Deselect a card                 | Tap a selected card                                       |
| Play a no-target card           | Tap card → tap `PLAY` button                              |
| Target an organ (virus etc.)    | Tap card → tap target organ on a bot seat                 |
| Target a player (Medical Error) | Tap card → tap target's avatar                            |
| Transplant (organ↔organ)        | Tap card → tap first organ → tap second organ             |
| Discard 1–3 cards               | Tap up to 3 cards → tap `DISCARD`                         |
| Pass turn (empty hand)          | Auto-passes (existing effect, unchanged)                  |
| Open menu                       | Tap `☰` in top app bar                                    |
| Close menu                      | Tap backdrop, or tap `NEW GAME`                           |

All tap targets ≥ 44×44px (Apple HIG minimum).

No new optimistic state. Server stays authoritative; the client renders the last snapshot — unchanged invariant.

---

## Non-goals / explicitly omitted

- **Landscape phone** layout. Out of scope; landscape phones get the desktop grid via the breakpoint and may look squashed. Acceptable per user direction.
- **Drag-to-dismiss** for the bottom sheet. Tap-only first.
- **Drag-to-reorder** hand cards. Not requested.
- **Haptic feedback.** Browser support is uneven; skip.
- **PWA / install prompt / offline.** Not in scope.
- **Tablet-specific layout** (e.g., 768–1024px). Tablets get the desktop layout, which is already fluid via `vh`/`clamp`.
- **Automated mobile tests.** Layout work; verification is manual via Chrome DevTools device emulation.

---

## Testing

Manual verification using `./run.sh dev` and Chrome DevTools device toolbar:

- iPhone SE (375×667) — smallest target.
- iPhone 14 Pro (393×852) — has dynamic island / safe areas.
- Pixel 7 (412×915) — Android baseline.

Checklist per device:

- [ ] No page-level horizontal scrollbar.
- [ ] All 3 bot seats visible without scrolling.
- [ ] Own organ row + hand strip both visible.
- [ ] Tap on a hand card selects it (scale + ring + badge appear).
- [ ] Hand strip scrolls horizontally without triggering pull-to-refresh.
- [ ] `PLAY` / `DISCARD` reachable with the thumb.
- [ ] Action bar not clipped by home indicator (safe-area inset honored).
- [ ] `☰` opens the bottom sheet; backdrop tap dismisses.
- [ ] Activity log scrolls inside the sheet.
- [ ] `NEW GAME` reloads cleanly.
- [ ] Turn pill text fits without wrapping.
- [ ] Targeting a bot organ via tap registers (play resolves on server).

Desktop regression: open at 1280×800; layout, animations, and side panel identical to current.

---

## Files

New:

- `frontend/src/game/useMediaQuery.ts`
- `frontend/src/components/MobileMenu.tsx`

Modified:

- `frontend/src/pages/Game.tsx`
- `frontend/src/components/Hand.tsx`
- `frontend/src/components/BoardSeat.tsx`
- `frontend/index.html` (viewport meta)
- `frontend/src/styles/index.css` (safe-area + overscroll utilities)

Untouched:

- Backend (`backend/app/*`) — pure UI work.
- Game state, store, websocket, actions, snapshot shape.
- `CardFront`, `CardBack`, `OrganRow` internals, `Avatar`, `ActivityLog`, `Settings`, `ThemeToggle`, `Toast`, `Banner`.
