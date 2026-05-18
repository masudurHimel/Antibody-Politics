import { useStore } from "./store";

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
