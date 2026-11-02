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

// Sockets closed on purpose (leaving a game) must not auto-reconnect.
const closedOnPurpose = new WeakSet<WebSocket>();

export function closeWs(ws: WebSocket) {
  closedOnPurpose.add(ws);
  ws.close();
}

function wireWs(ws: WebSocket, reconnect: () => void, idForAttach: string) {
  let pinger: number | null = null;
  ws.onmessage = (e) => {
    if (closedOnPurpose.has(ws)) return;
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
    if (closedOnPurpose.has(ws)) return;
    const st = useStore.getState();
    const snap = st.snapshot;
    const terminated = st.terminated;
    if (terminated) return;
    if (!snap || snap.winner_idx == null) {
      setTimeout(() => {
        if (!closedOnPurpose.has(ws)) reconnect();
      }, 1000);
    }
  };
}
