from __future__ import annotations

from typing import Iterator, Optional, Protocol

from .models import GameState


class GameStore(Protocol):
    def get(self, game_id: str) -> Optional[GameState]: ...
    def set(self, state: GameState) -> None: ...
    def delete(self, game_id: str) -> None: ...
    def iter_games(self) -> Iterator[GameState]: ...


class InMemoryStore:
    def __init__(self) -> None:
        self._games: dict[str, GameState] = {}

    def get(self, game_id: str) -> Optional[GameState]:
        return self._games.get(game_id)

    def set(self, state: GameState) -> None:
        self._games[state.game_id] = state

    def delete(self, game_id: str) -> None:
        self._games.pop(game_id, None)

    def iter_games(self) -> Iterator[GameState]:
        return iter(self._games.values())
