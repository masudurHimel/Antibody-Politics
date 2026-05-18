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


from .ws import make_ws_router

app.include_router(make_ws_router(lambda: STORE))

# Static frontend (prod mode)
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(_DIST / "index.html")
