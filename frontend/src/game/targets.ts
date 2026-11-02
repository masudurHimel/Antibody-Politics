// Client-side mirror of the official Virus! targeting rules the backend enforces.
// Pure functions only: they read a snapshot and never mutate it. The server stays authoritative;
// this module only decides what glows and which clicks become actions.
import type { Card, Color, Organ, PlayerView, Snapshot } from "./types";
import type { OrganRef } from "../three/contract";

export type AttachEffect = "infect" | "destroy" | "neutralize" | "cure" | "vaccinate" | "immunize";

export type Move =
  | { kind: "organ" }
  | { kind: "instant" } // Latex Glove, Contagion
  | { kind: "attach"; target: OrganRef } // virus / medicine
  | { kind: "thief"; target: OrganRef }
  | { kind: "transplant"; a: OrganRef; b: OrganRef }
  | { kind: "error"; player: number };

/** Multicolor matches anything. */
export function colorsMatch(a: Color, b: Color): boolean {
  return a === "multi" || b === "multi" || a === b;
}

/** A body holds at most one organ per colour; the multicolor organ is its own fifth "colour". */
export function canHold(body: Organ[], color: Color, exceptOrganId?: string): boolean {
  return !body.some((o) => o.id !== exceptOrganId && o.color === color);
}

function attachedOf(organ: Organ, type: "virus" | "medicine"): Card[] {
  return organ.attached.filter((c) => c.type === type);
}

/** What a virus or medicine would do to this organ, or null when it can't be played there. */
export function attachEffect(card: Card, organ: Organ): AttachEffect | null {
  if (organ.status === "immunized") return null;
  if (!colorsMatch(card.color, organ.color)) return null;
  if (card.type === "virus") {
    if (organ.status === "vaccinated") {
      const med = attachedOf(organ, "medicine")[0];
      return med && colorsMatch(card.color, med.color) ? "neutralize" : null;
    }
    return organ.status === "infected" ? "destroy" : "infect";
  }
  if (card.type === "medicine") {
    if (organ.status === "infected") {
      const virus = attachedOf(organ, "virus")[0];
      return virus && colorsMatch(card.color, virus.color) ? "cure" : null;
    }
    return organ.status === "vaccinated" ? "immunize" : "vaccinate";
  }
  return null;
}

function ref(p: PlayerView, o: Organ): OrganRef {
  return { player: p.idx, organ_id: o.id };
}

/** Every legal way for player `me` to play `card` on this table. */
export function legalMoves(snap: Snapshot, me: number, card: Card): Move[] {
  const mine = snap.players[me];
  if (!mine) return [];
  const out: Move[] = [];

  if (card.type === "organ") {
    if (canHold(mine.body, card.color)) out.push({ kind: "organ" });
    return out;
  }

  if (card.type === "virus" || card.type === "medicine") {
    for (const p of snap.players)
      for (const o of p.body) if (attachEffect(card, o)) out.push({ kind: "attach", target: ref(p, o) });
    return out;
  }

  switch (card.treatment_kind) {
    case "latex_glove":
    case "contagion":
      out.push({ kind: "instant" });
      break;
    case "organ_thief":
      for (const p of snap.players) {
        if (p.idx === me) continue;
        for (const o of p.body)
          if (o.status !== "immunized" && canHold(mine.body, o.color)) out.push({ kind: "thief", target: ref(p, o) });
      }
      break;
    case "transplant":
      // Swap one organ between ANY two different players, the card's owner included or not.
      snap.players.forEach((A, ia) =>
        snap.players.forEach((B, ib) => {
          if (ib <= ia) return;
          for (const x of A.body) {
            if (x.status === "immunized") continue;
            for (const y of B.body) {
              if (y.status === "immunized") continue;
              if (canHold(A.body, y.color, x.id) && canHold(B.body, x.color, y.id))
                out.push({ kind: "transplant", a: ref(A, x), b: ref(B, y) });
            }
          }
        }),
      );
      break;
    case "medical_error":
      for (const p of snap.players) if (p.idx !== me) out.push({ kind: "error", player: p.idx });
      break;
  }
  return out;
}

/** The `targets` payload the server expects for a move. */
export function moveTargets(move: Move): Record<string, unknown> {
  switch (move.kind) {
    case "organ":
    case "instant":
      return {};
    case "attach":
    case "thief":
      return { player: move.target.player, organ_id: move.target.organ_id };
    case "transplant":
      return { from: move.a, to: move.b };
    case "error":
      return { player: move.player };
  }
}
