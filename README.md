# Antibody Politics

A digital implementation of the Spanish card game **Virus!** — 1 human vs 3 bots, online multiplayer in Phase 2.

## Quick start

```bash
./run.sh
# Open http://127.0.0.1:8001
```

For dev with hot reload: `./run.sh dev` (open `:5173`).

## Play with friends (ngrok)

To host a multiplayer game accessible to friends over the internet:

1. In one terminal: `./run.sh` (boots backend on `:8001`).
2. In another: `./scripts/tunnel.sh` (forwards `:8001` through ngrok).
3. Share the `https://*.ngrok-free.app/` URL ngrok prints.

The host taps **MULTIPLAYER → CREATE**, copies the invite link from the
lobby (`/join/<room-id>`), and shares it. Each friend opens the link, enters
a name, taps **READY**. The host taps **START** once everyone is ready;
empty seats are filled with bots.

## Docs

- Design spec: [`docs/specs/spec.md`](docs/specs/spec.md)
- Architectural decisions: [`docs/specs/decisions.md`](docs/specs/decisions.md)
- Implementation plan: [`docs/specs/plan.md`](docs/specs/plan.md)
- Changelog: [`docs/changelog.md`](docs/changelog.md)

## Tech

Python 3.11 · FastAPI · Pydantic v2 · React 18 · Vite · TypeScript · Tailwind · Framer Motion · Zustand
