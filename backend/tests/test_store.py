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
