import pytest

from app.room import (
    ROOM_ID_ALPHABET,
    BadState,
    InMemoryRoomStore,
    InvalidName,
    NotAllReady,
    NotHost,
    Room,
    RoomFull,
    RoomNotJoinable,
    RoomPlayer,
    create_room,
    generate_room_id,
    normalize_name,
)


def test_room_player_defaults():
    p = RoomPlayer(token="abc", seat=0, name="Alice", is_host=True)
    assert p.ready is False
    assert p.is_bot is False
    assert p.connected is False


def test_in_memory_store_round_trip():
    store = InMemoryRoomStore()
    room = Room(
        id="AB12",
        status="lobby",
        players=[RoomPlayer(token="t1", seat=0, name="Alice", is_host=True)],
        created_at=0.0,
    )
    store.set(room)
    fetched = store.get("AB12")
    assert fetched is not None
    assert fetched.players[0].name == "Alice"
    store.delete("AB12")
    assert store.get("AB12") is None


def test_normalize_name_strips_and_caps():
    assert normalize_name("  Bob  ") == "Bob"
    assert normalize_name("X" * 30) == "X" * 20


def test_normalize_name_rejects_empty():
    with pytest.raises(InvalidName):
        normalize_name("   ")


def test_room_id_uses_safe_alphabet():
    store = InMemoryRoomStore()
    rid = generate_room_id(store)
    assert len(rid) == 4
    assert all(c in ROOM_ID_ALPHABET for c in rid)


def test_create_room_assigns_host_seat_zero():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    assert len(room.players) == 1
    assert room.players[0].seat == 0
    assert room.players[0].is_host is True
    assert room.players[0].name == "Alice"
    assert room.players[0].token == host_token
    assert room.status == "lobby"
    assert store.get(room.id) is room


def test_create_room_avoids_id_collision():
    store = InMemoryRoomStore()
    first, _ = create_room(store, host_name="Alice")
    seen = {first.id}
    for i in range(50):
        r, _ = create_room(store, host_name=f"P{i}")
        assert r.id not in seen
        seen.add(r.id)


from app.room import join_room, set_ready, start_room, terminate_room


def test_join_room_fills_next_seat():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="Alice")
    room2, bob_token = join_room(store, room.id, name="Bob")
    assert room2.players[1].seat == 1
    assert room2.players[1].name == "Bob"
    assert room2.players[1].token == bob_token
    assert room2.players[1].is_host is False


def test_join_room_caps_at_four():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="A")
    join_room(store, room.id, name="B")
    join_room(store, room.id, name="C")
    join_room(store, room.id, name="D")
    with pytest.raises(RoomFull):
        join_room(store, room.id, name="E")


def test_join_room_rejects_non_lobby():
    store = InMemoryRoomStore()
    room, _ = create_room(store, host_name="A")
    room.status = "playing"
    store.set(room)
    with pytest.raises(RoomNotJoinable):
        join_room(store, room.id, name="B")


def test_set_ready_toggle():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    set_ready(store, room.id, host_token, ready=True)
    assert store.get(room.id).players[0].ready is True
    set_ready(store, room.id, host_token, ready=False)
    assert store.get(room.id).players[0].ready is False


def test_start_requires_host():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    _, bob_token = join_room(store, room.id, name="B")
    set_ready(store, room.id, host_token, ready=True)
    set_ready(store, room.id, bob_token, ready=True)
    with pytest.raises(NotHost):
        start_room(store, room.id, bob_token, game_seed=42)


def test_start_requires_all_humans_ready():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    _, bob_token = join_room(store, room.id, name="B")
    set_ready(store, room.id, host_token, ready=True)
    with pytest.raises(NotAllReady):
        start_room(store, room.id, host_token, game_seed=42)


def test_start_fills_bots_and_resolves_seats():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="Alice")
    _, bob_token = join_room(store, room.id, name="Bob")
    set_ready(store, room.id, host_token, ready=True)
    set_ready(store, room.id, bob_token, ready=True)
    room2, game_state = start_room(store, room.id, host_token, game_seed=42)
    assert room2.status == "playing"
    assert room2.game_id == game_state.game_id
    assert len(room2.players) == 4
    assert [p.is_bot for p in room2.players] == [False, False, True, True]
    assert game_state.players[2].is_bot is True
    assert game_state.players[2].name.startswith("Bot")


def test_terminate_only_when_paused():
    store = InMemoryRoomStore()
    room, host_token = create_room(store, host_name="A")
    with pytest.raises(BadState):
        terminate_room(store, room.id, host_token)
    room.status = "paused"
    store.set(room)
    terminate_room(store, room.id, host_token)
    assert store.get(room.id).status == "ended"
