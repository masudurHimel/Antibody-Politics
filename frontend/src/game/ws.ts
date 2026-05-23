import { useStore } from "./store";
import type { ServerEvent } from "./types";

export function connectWs(gameId: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/games/${gameId}`);
  wireWs(ws, () => connectWs(gameId), gameId);
  return ws;
}

export function connectRoomWs(roomId: string, token: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(
    `${proto}://${location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`,
  );
  wireWs(ws, () => connectRoomWs(roomId, token), roomId);
  return ws;
}

function wireWs(ws: WebSocket, reconnect: () => void, idForAttach: string) {
  let pinger: number | null = null;
  ws.onmessage = (e) => {
    const ev = JSON.parse(e.data) as ServerEvent;
    useStore.getState().applyServerEvent(ev);
  };
  ws.onopen = () => {
    useStore.getState().attach(idForAttach, ws);
    pinger = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    }, 20000);
  };
  ws.onclose = () => {
    if (pinger) window.clearInterval(pinger);
    const st = useStore.getState();
    const snap = st.snapshot;
    const terminated = st.terminated;
    if (terminated) return;
    if (!snap || snap.winner_idx == null) {
      setTimeout(reconnect, 1000);
    }
  };
}
