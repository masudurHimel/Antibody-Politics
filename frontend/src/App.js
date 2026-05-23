import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Game from "./pages/Game";
import NewGame from "./pages/NewGame";
import MultiplayerLanding from "./pages/MultiplayerLanding";
import JoinRoom from "./pages/JoinRoom";
import Lobby from "./pages/Lobby";
import { useStore } from "./game/store";
import { connectRoomWs } from "./game/ws";
import { loadToken } from "./game/room";
function detectInitial() {
    const m = location.pathname.match(/^\/join\/([A-Z0-9]{4})$/i);
    if (m)
        return { screen: "join", roomId: m[1].toUpperCase() };
    return { screen: "home" };
}
export default function App() {
    const initial = detectInitial();
    const [screen, setScreen] = useState(initial.screen);
    const [roomId, setRoomId] = useState(initial.roomId ?? null);
    const setRoomContext = useStore((s) => s.setRoomContext);
    const clearRoom = useStore((s) => s.clearRoom);
    const playerToken = useStore((s) => s.playerToken);
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
    function onSoloStart(_gameId) {
        setScreen("game");
    }
    function onMpCreated(rid, token, seat) {
        setRoomContext(rid, token, seat);
        connectRoomWs(rid, token);
        setRoomId(rid);
        history.replaceState({}, "", "/");
        setScreen("lobby");
    }
    function onJoined(rid, token, seat) {
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
    if (screen === "mp_landing") {
        return (_jsx(MultiplayerLanding, { onCreated: onMpCreated, onCancel: () => setScreen("home") }));
    }
    if (screen === "join" && roomId) {
        return (_jsx(JoinRoom, { roomId: roomId, onJoined: onJoined, onCancel: () => {
                history.replaceState({}, "", "/");
                setScreen("home");
            } }));
    }
    if (screen === "lobby" && roomId && playerToken) {
        return (_jsx(Lobby, { roomId: roomId, token: playerToken, onStarted: () => setScreen("game"), onLeave: leaveLobby }));
    }
    if (screen === "game")
        return _jsx(Game, {});
    return (_jsx(NewGame, { onStart: onSoloStart, onMultiplayer: () => setScreen("mp_landing") }));
}
