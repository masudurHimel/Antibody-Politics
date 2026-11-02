// Pure selection → targets → action logic for the game shell. The 3D scene only renders what this returns
// and reports clicks back; Game.tsx feeds those clicks through `resolve*Click` and sends the result.
import type { Card, Color, Snapshot } from "./types";
import type { OrganRef } from "../three/contract";
import { legalMoves, moveTargets, type Move } from "./targets";

export const ORGAN_NAME: Record<Color, string> = {
  red: "Heart",
  green: "Stomach",
  blue: "Brain",
  yellow: "Bone",
  multi: "Wild organ",
};

const COLOR_NAME: Record<Color, string> = {
  red: "Red",
  green: "Green",
  blue: "Blue",
  yellow: "Yellow",
  multi: "Multicolor",
};

const TREATMENT_NAME = {
  contagion: "Contagion",
  organ_thief: "Organ Thief",
  transplant: "Transplant",
  latex_glove: "Latex Glove",
  medical_error: "Medical Error",
} as const;

export function cardName(card: Card): string {
  if (card.type === "organ") return ORGAN_NAME[card.color];
  if (card.type === "virus") return `${COLOR_NAME[card.color]} virus`;
  if (card.type === "medicine") return `${COLOR_NAME[card.color]} medicine`;
  return card.treatment_kind ? TREATMENT_NAME[card.treatment_kind] : "Treatment";
}

/** A game is in progress when one is dealt and nobody has won yet; leaving it then needs confirmation. */
export function gameInProgress(snap: Snapshot | null): boolean {
  return !!snap && snap.winner_idx === null;
}

export const IDLE_HINT = "Your turn. Click a card to select it.";

export interface TargetView {
  targetOrgans: Set<string>;
  targetPlayers: Set<number>;
  showGhostSlot: boolean;
  /** move the Play button sends, or null when Play is disabled */
  playMove: Move | null;
  hint: string;
}

const sameRef = (a: OrganRef, b: OrganRef) => a.player === b.player && a.organ_id === b.organ_id;

/** Partners of `pending` across every legal transplant pair. */
function transplantPartners(moves: Move[], pending: OrganRef): OrganRef[] {
  const out: OrganRef[] = [];
  for (const m of moves) {
    if (m.kind !== "transplant") continue;
    if (sameRef(m.a, pending)) out.push(m.b);
    else if (sameRef(m.b, pending)) out.push(m.a);
  }
  return out;
}

const isInstant = (card: Card) =>
  card.type === "treatment" && (card.treatment_kind === "latex_glove" || card.treatment_kind === "contagion");

/**
 * What glows and what Play does for the current hand selection.
 * `card` is the single selected card (null for 0 or 2+ selected), `count` the selection size.
 */
export function targetView(
  snap: Snapshot,
  me: number,
  card: Card | null,
  count: number,
  pending: OrganRef | null,
): TargetView {
  const view: TargetView = {
    targetOrgans: new Set(),
    targetPlayers: new Set(),
    showGhostSlot: false,
    playMove: null,
    hint: IDLE_HINT,
  };
  if (count === 0) return view;
  if (!card) {
    view.hint = `${count} cards selected. Press Discard ${count} to throw them away.`;
    return view;
  }

  const name = cardName(card);
  const moves = legalMoves(snap, me, card);
  if (!moves.length) {
    view.hint = `${name} has no legal target right now. Press Discard to throw it away.`;
    return view;
  }
  if (card.type === "organ" || isInstant(card) || moves.length === 1) view.playMove = moves[0];
  const orPlay = moves.length === 1 ? ", or press Play" : "";

  if (card.type === "organ") {
    view.showGhostSlot = true;
    view.hint = `Press Play or click the glowing slot to place your ${ORGAN_NAME[card.color]}.`;
  } else if (isInstant(card)) {
    view.hint = `${name}: press Play.`;
  } else if (card.treatment_kind === "medical_error") {
    for (const m of moves) if (m.kind === "error") view.targetPlayers.add(m.player);
    view.hint = `Medical Error: click the body to swap with${orPlay}.`;
  } else if (card.treatment_kind === "transplant") {
    if (pending) {
      for (const r of transplantPartners(moves, pending)) view.targetOrgans.add(r.organ_id);
      view.playMove = null;
      view.hint = "Transplant: now click the organ to swap it with.";
    } else {
      for (const m of moves) if (m.kind === "transplant") view.targetOrgans.add(m.a.organ_id).add(m.b.organ_id);
      view.hint = `Transplant: click the first organ to swap${orPlay}.`;
    }
  } else {
    for (const m of moves) if (m.kind === "attach" || m.kind === "thief") view.targetOrgans.add(m.target.organ_id);
    view.hint = `${name}: click a glowing organ${orPlay}.`;
  }
  return view;
}

export type ClickResult =
  | { type: "play"; cardId: string; targets: Record<string, unknown> }
  | { type: "pending"; pending: OrganRef | null }
  | { type: "none" };

const NONE: ClickResult = { type: "none" };

function play(card: Card, move: Move): ClickResult {
  return { type: "play", cardId: card.id, targets: moveTargets(move) };
}

/** What a click on an organ means for the single selected card. */
export function resolveOrganClick(
  snap: Snapshot,
  me: number,
  card: Card | null,
  pending: OrganRef | null,
  clicked: OrganRef,
): ClickResult {
  if (!card) return NONE;
  const moves = legalMoves(snap, me, card);

  if (card.treatment_kind === "medical_error" && card.type === "treatment") {
    return resolvePlayerClick(snap, me, card, clicked.player);
  }

  if (card.treatment_kind === "transplant" && card.type === "treatment") {
    if (!pending) {
      return transplantPartners(moves, clicked).length ? { type: "pending", pending: clicked } : NONE;
    }
    if (sameRef(pending, clicked)) return { type: "pending", pending: null };
    const ok = transplantPartners(moves, pending).some((r) => sameRef(r, clicked));
    return ok ? play(card, { kind: "transplant", a: pending, b: clicked }) : NONE;
  }

  const m = moves.find((m) => (m.kind === "attach" || m.kind === "thief") && sameRef(m.target, clicked));
  return m ? play(card, m) : NONE;
}

/** What a click on a player's body means (Medical Error only). */
export function resolvePlayerClick(snap: Snapshot, me: number, card: Card | null, player: number): ClickResult {
  if (!card || card.type !== "treatment" || card.treatment_kind !== "medical_error") return NONE;
  const m = legalMoves(snap, me, card).find((m) => m.kind === "error" && m.player === player);
  return m ? play(card, m) : NONE;
}

/** Ghost slot click: place the selected organ. */
export function resolveGhostClick(snap: Snapshot, me: number, card: Card | null): ClickResult {
  if (!card || card.type !== "organ") return NONE;
  const m = legalMoves(snap, me, card)[0];
  return m ? play(card, m) : NONE;
}
