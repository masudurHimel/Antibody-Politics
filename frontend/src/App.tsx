import { useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  return gameId ? <Game /> : <NewGame onStart={(id) => setGameId(id)} />;
}
