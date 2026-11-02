// Snapshot builders shared by the scene's unit tests.
import type { Card, Color, Organ, OrganStatus, Snapshot } from "../game/types";

export const mkCard = (id: string, type: Card["type"] = "organ", color: Color = "red", treatment_kind: Card["treatment_kind"] = null): Card => ({
  id,
  type,
  color,
  treatment_kind,
});

export const mkOrgan = (id: string, color: Color = "red", attached: Card[] = [], status: OrganStatus = "free"): Organ => ({
  id,
  color,
  attached,
  status,
});

export function mkSnap(n: number, viewer = 0, over: Partial<Snapshot> = {}): Snapshot {
  return {
    game_id: "g",
    viewer_idx: viewer,
    turn_idx: 0,
    winner_idx: null,
    deck_count: 40,
    discard_count: 0,
    discard_top: null,
    event_log: [],
    players: Array.from({ length: n }, (_, p) => ({
      idx: p,
      name: `P${p}`,
      is_bot: p !== viewer,
      hand: p === viewer ? [mkCard(`h${p}-0`), mkCard(`h${p}-1`, "virus"), mkCard(`h${p}-2`, "medicine")] : null,
      hand_count: 3,
      body: [],
    })),
    ...over,
  };
}
