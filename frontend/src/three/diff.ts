// Pure snapshot diffing: which cards are the "heroes" of the last action, which flair to show, and how the
// anonymous meshes standing in for opponents' hands change.
import type { OrganStatus, Snapshot } from "../game/types";
import type { LastAction } from "./contract";

export type CardLoc =
  | { kind: "hand" }
  | { kind: "discard" }
  | { kind: "organ"; player: number; organId: string; attached: boolean; faceDown: boolean };

/** every face-known card on the table or in the viewer's hand, by id */
export function locateCards(snap: Snapshot): Map<string, CardLoc> {
  const out = new Map<string, CardLoc>();
  for (const c of snap.players[snap.viewer_idx]?.hand ?? []) out.set(c.id, { kind: "hand" });
  if (snap.discard_top) out.set(snap.discard_top.id, { kind: "discard" });
  snap.players.forEach((P, p) => {
    for (const o of P.body) {
      out.set(o.id, { kind: "organ", player: p, organId: o.id, attached: false, faceDown: false });
      const imm = o.status === "immunized";
      for (const c of o.attached) out.set(c.id, { kind: "organ", player: p, organId: o.id, attached: true, faceDown: imm && c.type === "medicine" });
    }
  });
  return out;
}

function tableIds(snap: Snapshot): Set<string> {
  const ids = new Set<string>();
  if (snap.discard_top) ids.add(snap.discard_top.id);
  for (const P of snap.players)
    for (const o of P.body) {
      ids.add(o.id);
      for (const c of o.attached) ids.add(c.id);
    }
  return ids;
}

export interface Heroes {
  /** card ids that arc with the back-ease overshoot */
  heroes: Set<string>;
  /** heroes played by an opponent: they spawn at that player's hand */
  spawnFrom: Map<string, number>;
}

/**
 * The cards just played or discarded by `action.player`. For the viewer these are the cards that left the hand;
 * an opponent's cards are anonymous, so their heroes are ids that newly appear on the table or on the discard top.
 */
export function diffHeroes(prev: Snapshot | null, next: Snapshot, action: LastAction | null): Heroes {
  const heroes = new Set<string>(),
    spawnFrom = new Map<string, number>();
  if (!prev || !action || action.kind === "pass") return { heroes, spawnFrom };
  if (action.player === next.viewer_idx) {
    const still = new Set((next.players[next.viewer_idx]?.hand ?? []).map((c) => c.id));
    for (const c of prev.players[prev.viewer_idx]?.hand ?? []) if (!still.has(c.id)) heroes.add(c.id);
    return { heroes, spawnFrom };
  }
  const known = tableIds(prev);
  for (const c of prev.players[prev.viewer_idx]?.hand ?? []) known.add(c.id);
  for (const id of tableIds(next))
    if (!known.has(id)) {
      heroes.add(id);
      spawnFrom.set(id, action.player);
    }
  return { heroes, spawnFrom };
}

export type FlairKind = "infect" | "destroy" | "neutralize" | "cure" | "vaccinate" | "immunize" | "swap" | "wipe";

export interface FlairEvent {
  kind: FlairKind;
  /** organ the effect lands on; absent for table-wide events */
  organId?: string;
}

export const FLAIR_WORD: Record<FlairKind, string> = {
  infect: "Infected!",
  destroy: "Destroyed!",
  neutralize: "Vaccine broken",
  cure: "Cured",
  vaccinate: "Vaccinated",
  immunize: "Immunized!",
  swap: "Bodies swapped!",
  wipe: "Hands wiped!",
};

export const FLAIR_COLOR: Record<FlairKind, string> = {
  infect: "#EF3E65",
  destroy: "#FF5A5A",
  neutralize: "#F39A3A",
  cure: "#7FD6B5",
  vaccinate: "#8FCBFF",
  immunize: "#F2C14E",
  swap: "#EDF7A0",
  wipe: "#C9F5DD",
};

function statusFlair(from: OrganStatus, to: OrganStatus): FlairKind | null {
  if (from === to) return null;
  if (to === "immunized") return "immunize";
  if (to === "vaccinated") return "vaccinate";
  if (to === "infected") return from === "free" ? "infect" : null;
  if (from === "vaccinated") return "neutralize";
  if (from === "infected") return "cure";
  return null;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** status changes, destroyed organs, Medical Error body swaps and Latex Glove hand wipes between two snapshots */
export function diffFlair(prev: Snapshot | null, next: Snapshot): FlairEvent[] {
  if (!prev || prev.game_id !== next.game_id) return [];
  const out: FlairEvent[] = [];
  const nextStatus = new Map<string, OrganStatus>();
  for (const P of next.players) for (const o of P.body) nextStatus.set(o.id, o.status);
  for (const P of prev.players)
    for (const o of P.body) {
      const s = nextStatus.get(o.id);
      if (s === undefined) {
        out.push({ kind: "destroy", organId: o.id });
        continue;
      }
      const k = statusFlair(o.status, s);
      if (k) out.push({ kind: k, organId: o.id });
    }

  const newTop = next.discard_top && next.discard_top.id !== prev.discard_top?.id ? next.discard_top : null;
  if (newTop?.treatment_kind === "medical_error") {
    const bodies = (s: Snapshot) => s.players.map((P) => new Set(P.body.map((o) => o.id)));
    const a0 = bodies(prev),
      a1 = bodies(next);
    let swapped = false;
    for (let a = 0; a < a0.length && !swapped; a++)
      for (let b = a + 1; b < a0.length && !swapped; b++)
        swapped = (a0[a].size > 0 || a0[b].size > 0) && sameSet(a1[a], a0[b]) && sameSet(a1[b], a0[a]) && !sameSet(a0[a], a0[b]);
    if (swapped) out.push({ kind: "swap" });
  }

  // Latex Glove: every hand but (at most) the player's own is empty now, and at least one just got emptied
  const emptied = next.players.filter((P, i) => P.hand_count === 0 && (prev.players[i]?.hand_count ?? 0) > 0).length;
  const empty = next.players.filter((P) => P.hand_count === 0).length;
  if (next.players.length > 1 && emptied > 0 && empty >= next.players.length - 1)
    out.push({ kind: "wipe" });
  return out;
}

/**
 * Next list of anonymous mesh ids for an opponent's hand: the last `consumed` cards became heroes (they fly from
 * the hand to the table), extras beyond `count` are dropped, and missing ones are freshly drawn.
 */
export function nextOppHand(prev: string[], count: number, consumed: number, newId: () => string): { ids: string[]; consumed: string[] } {
  const keep = prev.slice(0, Math.max(0, prev.length - consumed));
  const used = prev.slice(keep.length);
  const ids = keep.slice(0, count);
  while (ids.length < count) ids.push(newId());
  return { ids, consumed: used };
}
