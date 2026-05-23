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
from .room import InMemoryRoomStore
from .room_api import make_room_router
from .snapshot import public_snapshot
from .store import GameStore, InMemoryStore


app = FastAPI(title="Antibody Politics")
STORE: GameStore = InMemoryStore()
ROOM_STORE = InMemoryRoomStore()
DRIVERS: dict[str, Any] = {}
BROADCASTERS: dict[str, Any] = {}
HUMAN_IDX = 0
DEFAULT_NAMES = ["You", "Bot Alpha", "Bot Bravo", "Bot Charlie"]


def _start_room_driver(room_id: str, game_id: str) -> None:
    from .broadcast import Broadcaster
    from .driver import GameDriver

    bc = BROADCASTERS.setdefault(room_id, Broadcaster())
    driver = GameDriver(
        room_id=room_id, game_id=game_id,
        game_store=STORE, room_store=ROOM_STORE, broadcaster=bc,
    )
    DRIVERS[room_id] = driver
    driver.start()


class CreateGameBody(BaseModel):
    seed: Optional[int] = None
    names: Optional[list[str]] = None


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/host_url")
async def host_url() -> dict[str, Optional[str]]:
    """Return the public URL the lobby should use for invite links.

    Resolution order:
      1. PUBLIC_BASE_URL env var (set this in CI/prod or if you don't use ngrok)
      2. ngrok's local API at http://127.0.0.1:4040/api/tunnels (when ./scripts/tunnel.sh is running)
      3. null — frontend falls back to window.location.origin
    """
    env = os.environ.get("PUBLIC_BASE_URL")
    if env:
        return {"public_url": env.rstrip("/")}
    try:
        import httpx  # already a backend dependency
        async with httpx.AsyncClient(timeout=0.4) as client:
            r = await client.get("http://127.0.0.1:4040/api/tunnels")
        if r.status_code == 200:
            tunnels = r.json().get("tunnels", [])
            https = [t.get("public_url") for t in tunnels if t.get("public_url", "").startswith("https://")]
            if https:
                return {"public_url": https[0]}
            if tunnels:
                return {"public_url": tunnels[0].get("public_url")}
    except Exception:
        pass
    return {"public_url": None}


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


async def _broadcast_room_state(room_id: str, public_view: dict[str, Any]) -> None:
    bc = BROADCASTERS.get(room_id)
    if bc is None:
        return
    await bc.broadcast_per_seat(
        lambda viewer: {"type": "room_state", "my_seat": viewer, "room": public_view}
    )
    # When the room transitions to "playing", every connected client needs an
    # initial per-viewer snapshot so the Game screen has something to render
    # before the first action lands.
    if public_view.get("status") == "playing" and public_view.get("game_id"):
        state = STORE.get(public_view["game_id"])
        if state is not None:
            await bc.broadcast_per_seat(
                lambda viewer: {
                    "type": "snapshot",
                    "snapshot": public_snapshot(state, viewer_idx=viewer),
                }
            )


async def _broadcast_terminated(room_id: str) -> None:
    bc = BROADCASTERS.get(room_id)
    if bc is not None:
        await bc.broadcast("terminated", {})
    driver = DRIVERS.pop(room_id, None)
    if driver is not None:
        await driver.cancel()


app.include_router(
    make_room_router(
        room_store_getter=lambda: ROOM_STORE,
        game_store_getter=lambda: STORE,
        start_driver=_start_room_driver,
        broadcast_room_state=_broadcast_room_state,
        broadcast_terminated=_broadcast_terminated,
    )
)

from .ws import make_ws_router

app.include_router(
    make_ws_router(
        lambda: STORE,
        room_store_getter=lambda: ROOM_STORE,
        broadcasters=BROADCASTERS,
        drivers=DRIVERS,
    )
)


@app.on_event("shutdown")
async def _shutdown() -> None:
    for d in list(DRIVERS.values()):
        await d.cancel()


# Static frontend (prod mode)
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(_DIST / "index.html")

    @app.get("/join/{room_id}")
    async def join_html(room_id: str) -> FileResponse:
        return FileResponse(_DIST / "index.html")
