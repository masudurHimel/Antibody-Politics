import { useStore } from "./store";
import type { ServerEvent } from "./types";

export function connectWs(gameId: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/games/${gameId}`);
  ws.onmessage = (e) => {
    const ev = JSON.parse(e.data) as ServerEvent;
    useStore.getState().applyServerEvent(ev);
  };
  ws.onopen = () => useStore.getState().attach(gameId, ws);
  ws.onclose = () => {
    // simple reconnect after 1s if no winner
    const snap = useStore.getState().snapshot;
    if (!snap || snap.winner_idx == null) {
      setTimeout(() => connectWs(gameId), 1000);
    }
  };
  return ws;
}
