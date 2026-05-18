import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";
export default function App() {
    const [gameId, setGameId] = useState(null);
    return gameId ? _jsx(Game, {}) : _jsx(NewGame, { onStart: (id) => setGameId(id) });
}
