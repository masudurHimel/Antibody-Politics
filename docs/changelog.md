# Changelog

All notable changes to Antibody Politics are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 2026-05-16 — Initial design spec (`docs/specs/spec.md`), architectural decisions (`docs/specs/decisions.md`), and Phase 1 task roadmap (`docs/specs/tasks.md`).
- 2026-05-16 — Source reference images committed under `sources/`.

### Decisions of note
- ADR-0001 React + Vite + Tailwind + Framer Motion as the frontend stack.
- ADR-0002 FastAPI + Pydantic v2 + uvicorn as the backend stack.
- ADR-0003 WebSocket-first communication from day 1.
- ADR-0005 Hybrid bot AI (heuristics + MCTS-lite on high-stakes branches).
- ADR-0009 `./run.sh` boots on `127.0.0.1:8001` in production mode.
