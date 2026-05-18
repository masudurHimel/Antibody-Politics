import { useStore } from "./store";
export function playCard(cardId, targets) {
    useStore.getState().send({ type: "play", card_id: cardId, targets });
    useStore.getState().clearSelection();
}
export function discardCards(ids) {
    useStore.getState().send({ type: "discard", card_ids: ids });
    useStore.getState().clearSelection();
}
export function passTurn() {
    useStore.getState().send({ type: "pass" });
}
