import { useEffect, useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";
import JoinRoom from "./pages/JoinRoom";
import Lobby from "./pages/Lobby";
import { useStore } from "./game/store";
import { connectRoomWs } from "./game/ws";
import { loadToken } from "./game/room";
import { leaveGame, startSoloGame } from "./game/actions";
import type { Mode } from "./three/contract";

type Screen = "home" | "join" | "lobby" | "game";

function detectInitial(): { screen: Screen; roomId?: string } {
  const m = location.pathname.match(/^\/join\/([A-Z0-9]{4})$/i);
  if (m) return { screen: "join", roomId: m[1].toUpperCase() };
  return { screen: "home" };
}

export default function App() {
  const initial = detectInitial();
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId ?? null);
  const setRoomContext = useStore((s) => s.setRoomContext);
  const clearRoom = useStore((s) => s.clearRoom);
  const playerToken = useStore((s) => s.playerToken);
  /** bumped to make Home scroll to and focus its multiplayer panel */
  const [focusMp, setFocusMp] = useState(0);

  // If we landed at /join/<id> and a token is already cached for that room,
  // jump straight to lobby without re-entering the name.
  useEffect(() => {
    if (initial.screen === "join" && initial.roomId) {
      const t = loadToken(initial.roomId);
      if (t) {
        setRoomContext(initial.roomId, t, -1);
        connectRoomWs(initial.roomId, t);
        setRoomId(initial.roomId);
        setScreen("lobby");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onJoined(rid: string, token: string, seat: number) {
    setRoomContext(rid, token, seat);
    connectRoomWs(rid, token);
    setRoomId(rid);
    history.replaceState({}, "", "/");
    setScreen("lobby");
  }

  function leaveLobby() {
    clearRoom();
    history.replaceState({}, "", "/");
    setRoomId(null);
    setScreen("home");
  }

  if (screen === "join" && roomId) {
    return (
      <JoinRoom
        roomId={roomId}
        onJoined={onJoined}
        onCancel={() => {
          history.replaceState({}, "", "/");
          setScreen("home");
        }}
      />
    );
  }

  if (screen === "lobby" && roomId && playerToken) {
    return (
      <Lobby
        roomId={roomId}
        token={playerToken}
        onStarted={() => setScreen("game")}
        onLeave={leaveLobby}
      />
    );
  }

  // Leaving a game from its header (mode switch / New game). Game asks for confirmation first.
  function playMode(mode: Mode) {
    leaveGame();
    setRoomId(null);
    if (mode === "mp") {
      setScreen("home");
      setFocusMp((n) => n + 1);
      return;
    }
    setScreen("game");
    startSoloGame().catch((e) => useStore.getState().setToast((e as Error).message));
  }

  if (screen === "game") {
    return (
      <Game
        onNewGame={() => playMode(useStore.getState().room ? "mp" : "solo")}
        onSwitchMode={playMode}
      />
    );
  }

  return (
    <NewGame onSoloStarted={() => setScreen("game")} onRoomEntered={onJoined} focusMp={focusMp} />
  );
}
