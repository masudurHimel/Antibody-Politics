import { useStore } from "./store";
import { closeWs, connectWs } from "./ws";

export function playCard(cardId: string, targets: Record<string, unknown>) {
  useStore.getState().send({ type: "play", card_id: cardId, targets });
  useStore.getState().clearSelection();
}

export function discardCards(ids: string[]) {
  useStore.getState().send({ type: "discard", card_ids: ids });
  useStore.getState().clearSelection();
}

export function passTurn() {
  useStore.getState().send({ type: "pass" });
}

/** Close the current game's socket (no reconnect) and forget the game and room. */
export function leaveGame() {
  const ws = useStore.getState().conn.ws;
  if (ws) closeWs(ws);
  useStore.getState().resetGame();
}

export async function startSoloGame() {
  const r = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  useStore.getState().setSnapshot(body.snapshot);
  connectWs(body.game_id);
}
