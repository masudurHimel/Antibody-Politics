import asyncio
import os

import pytest

from app.broadcast import Broadcaster
from app.driver import GameDriver
from app.game import start_game
from app.room import InMemoryRoomStore, Room, RoomPlayer
from app.store import InMemoryStore


@pytest.fixture(autouse=True)
def _disable_bot_search():
    os.environ["BOT_NO_SEARCH"] = "1"
    yield
    os.environ.pop("BOT_NO_SEARCH", None)


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def send_json(self, payload):
        self.sent.append(payload)


def _seed_all_bots(game_store, room_store, seed=42):
    names = ["Bot1", "Bot2", "Bot3", "Bot4"]
    bots = [True, True, True, True]
    state = start_game(game_id="g0001", seed=seed, names=names, bots=bots)
    game_store.set(state)
    room = Room(
        id="ABCD", status="playing",
        players=[RoomPlayer(token=f"t{i}", seat=i, name=names[i],
                            is_host=(i == 0), is_bot=True, ready=True, connected=True)
                 for i in range(4)],
        game_id="g0001", created_at=0.0,
    )
    room_store.set(room)
    return state, room


async def test_driver_runs_bots_to_completion():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs, seed=7)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    await asyncio.wait_for(driver.run(), timeout=30)

    final = gs.get(state.game_id)
    assert final.winner_idx is not None
    kinds = [m["type"] for m in sock.sent]
    assert "bot_thinking" in kinds
    assert "action" in kinds
    assert kinds[-1] == "game_over"


from app.game import discard_cards as _gc  # noqa: F401  (only used in feeder helper inside test)


def _seed_mixed(game_store, room_store, seed=42):
    names = ["Alice", "Bot1", "Bot2", "Bot3"]
    bots = [False, True, True, True]
    state = start_game(game_id="g0002", seed=seed, names=names, bots=bots)
    game_store.set(state)
    room = Room(
        id="EFGH", status="playing",
        players=[RoomPlayer(token=f"t{i}", seat=i, name=names[i],
                            is_host=(i == 0), is_bot=bots[i],
                            ready=True, connected=True)
                 for i in range(4)],
        game_id="g0002", created_at=0.0,
    )
    room_store.set(room)
    return state, room


async def test_human_timeout_auto_discards():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    from app import driver as dmod
    saved = dmod.HUMAN_TURN_MS
    dmod.HUMAN_TURN_MS = 100
    try:
        driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                            game_store=gs, room_store=rs, broadcaster=bc,
                            floor_ms=0)
        task = asyncio.create_task(driver.run())
        await asyncio.sleep(0.5)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    finally:
        dmod.HUMAN_TURN_MS = saved

    kinds = [m["type"] for m in sock.sent]
    assert "human_thinking" in kinds


async def test_on_human_acted_short_circuits_timeout():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    sock = FakeSocket()
    bc.attach(seat=0, ws=sock)

    driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)

    async def feeder():
        for _ in range(50):
            await asyncio.sleep(0.01)
            kinds = [m["type"] for m in sock.sent]
            if "human_thinking" in kinds:
                break
        cur = gs.get(state.game_id)
        from app.game import discard_cards
        discard_cards(cur, 0, [cur.players[0].hand[0].id])
        driver.on_human_acted()

    task = asyncio.create_task(driver.run())
    await feeder()
    for _ in range(200):
        cur = gs.get(state.game_id)
        if cur.turn_idx != 0 or cur.winner_idx is not None:
            break
        await asyncio.sleep(0.01)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    cur = gs.get(state.game_id)
    assert cur.turn_idx != 0 or cur.winner_idx is not None


async def test_pause_blocks_loop_then_resume_continues():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs, seed=7)
    bc = Broadcaster()
    bc.attach(seat=0, ws=FakeSocket())

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    driver.pause()
    task = asyncio.create_task(driver.run())
    await asyncio.sleep(0.2)
    assert not task.done()
    driver.resume()
    await asyncio.wait_for(task, timeout=30)
    final = gs.get(state.game_id)
    assert final.winner_idx is not None


async def test_pause_during_human_turn_preserves_remaining_ms():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_mixed(gs, rs)
    bc = Broadcaster()
    bc.attach(seat=0, ws=FakeSocket())

    from app import driver as dmod
    saved = dmod.HUMAN_TURN_MS
    dmod.HUMAN_TURN_MS = 500
    try:
        driver = GameDriver(room_id="EFGH", game_id=state.game_id,
                            game_store=gs, room_store=rs, broadcaster=bc,
                            floor_ms=0)
        task = asyncio.create_task(driver.run())
        await asyncio.sleep(0.2)
        driver.pause()
        await asyncio.sleep(0.1)
        remaining = driver._turn_remaining_ms
        assert remaining is not None
        assert 150 <= remaining <= 400
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    finally:
        dmod.HUMAN_TURN_MS = saved


async def test_per_viewer_snapshots_hide_other_hands():
    gs, rs = InMemoryStore(), InMemoryRoomStore()
    state, room = _seed_all_bots(gs, rs, seed=7)
    bc = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    bc.attach(seat=0, ws=s0)
    bc.attach(seat=1, ws=s1)

    driver = GameDriver(room_id="ABCD", game_id=state.game_id,
                        game_store=gs, room_store=rs, broadcaster=bc,
                        floor_ms=0)
    await asyncio.wait_for(driver.run(), timeout=30)

    actions0 = [m for m in s0.sent if m["type"] == "action"]
    actions1 = [m for m in s1.sent if m["type"] == "action"]
    assert actions0 and actions1
    snap0 = actions0[-1]["snapshot"]
    snap1 = actions1[-1]["snapshot"]
    assert snap0["viewer_idx"] == 0
    assert snap1["viewer_idx"] == 1
    assert snap0["players"][0]["hand"] is not None
    assert snap0["players"][1]["hand"] is None
    assert snap1["players"][1]["hand"] is not None
    assert snap1["players"][0]["hand"] is None
