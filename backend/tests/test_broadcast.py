import pytest

from app.broadcast import Broadcaster


class FakeSocket:
    def __init__(self):
        self.sent: list[dict] = []
        self.closed = False

    async def send_json(self, payload: dict) -> None:
        if self.closed:
            raise RuntimeError("closed")
        self.sent.append(payload)


async def test_broadcaster_sends_same_payload_to_all():
    b = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    b.attach(seat=0, ws=s0)
    b.attach(seat=1, ws=s1)
    await b.broadcast("hello", {"x": 1})
    assert s0.sent == [{"type": "hello", "x": 1}]
    assert s1.sent == [{"type": "hello", "x": 1}]


async def test_broadcaster_per_seat_payload():
    b = Broadcaster()
    s0, s1 = FakeSocket(), FakeSocket()
    b.attach(seat=0, ws=s0)
    b.attach(seat=1, ws=s1)
    await b.broadcast_per_seat(lambda seat: {"type": "snap", "viewer": seat})
    assert s0.sent[-1] == {"type": "snap", "viewer": 0}
    assert s1.sent[-1] == {"type": "snap", "viewer": 1}


async def test_broadcaster_detach_silently_drops():
    b = Broadcaster()
    s0 = FakeSocket()
    b.attach(seat=0, ws=s0)
    b.detach(seat=0)
    await b.broadcast("hello", {})
    assert s0.sent == []


async def test_broadcaster_handles_closed_socket():
    b = Broadcaster()
    s0 = FakeSocket()
    s0.closed = True
    b.attach(seat=0, ws=s0)
    await b.broadcast("hello", {})
    assert b.connected_seats() == set()
