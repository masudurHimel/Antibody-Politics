import { describe, expect, it } from "vitest";
import {
  IDLE_HINT,
  gameInProgress,
  resolveGhostClick,
  resolveOrganClick,
  resolvePlayerClick,
  targetView,
} from "./selection";
import type { Card, Color, Organ, PlayerView, Snapshot } from "./types";

const card = (id: string, type: Card["type"], color: Color, treatment_kind?: Card["treatment_kind"]): Card => ({
  id,
  type,
  color,
  treatment_kind,
});
const organ = (id: string, color: Color): Organ => ({ id, color, attached: [], status: "free" });

function snap(bodies: Organ[][]): Snapshot {
  const players: PlayerView[] = bodies.map((body, idx) => ({
    idx,
    name: `P${idx}`,
    is_bot: idx !== 0,
    hand: idx === 0 ? [] : null,
    hand_count: 3,
    body,
  }));
  return {
    game_id: "g",
    viewer_idx: 0,
    turn_idx: 0,
    winner_idx: null,
    deck_count: 40,
    discard_count: 0,
    discard_top: null,
    event_log: [],
    players,
  };
}

const ref = (player: number, organ_id: string) => ({ player, organ_id });

describe("targetView", () => {
  const s = snap([[organ("mr", "red")], [organ("r1", "red"), organ("b1", "blue")], [organ("g2", "green")]]);

  it("nothing selected: idle hint, nothing glows, Play disabled", () => {
    const v = targetView(s, 0, null, 0, null);
    expect(v.hint).toBe(IDLE_HINT);
    expect(v.targetOrgans.size + v.targetPlayers.size).toBe(0);
    expect(v.playMove).toBeNull();
  });

  it("several selected: discard hint only", () => {
    const v = targetView(s, 0, null, 2, null);
    expect(v.hint).toMatch(/Discard 2/);
    expect(v.playMove).toBeNull();
  });

  it("organ: ghost slot and Play enabled", () => {
    const v = targetView(s, 0, card("o", "organ", "blue"), 1, null);
    expect(v.showGhostSlot).toBe(true);
    expect(v.playMove).toEqual({ kind: "organ" });
  });

  it("organ with no room: no ghost, Play disabled", () => {
    const v = targetView(s, 0, card("o", "organ", "red"), 1, null);
    expect(v.showGhostSlot).toBe(false);
    expect(v.playMove).toBeNull();
    expect(v.hint).toMatch(/no legal target/);
  });

  it("virus with several targets glows them all; Play stays disabled", () => {
    const v = targetView(s, 0, card("v", "virus", "red"), 1, null);
    expect([...v.targetOrgans]).toEqual(["mr", "r1"]);
    expect(v.playMove).toBeNull();
  });

  it("exactly one legal target enables Play", () => {
    const v = targetView(s, 0, card("v", "virus", "green"), 1, null);
    expect([...v.targetOrgans]).toEqual(["g2"]);
    expect(v.playMove).toEqual({ kind: "attach", target: ref(2, "g2") });
  });

  it("Latex Glove and Contagion enable Play with no target", () => {
    expect(targetView(s, 0, card("l", "treatment", "multi", "latex_glove"), 1, null).playMove).toEqual({ kind: "instant" });
    expect(targetView(s, 0, card("c", "treatment", "multi", "contagion"), 1, null).playMove).toEqual({ kind: "instant" });
  });

  it("Medical Error glows every other player", () => {
    const v = targetView(s, 0, card("e", "treatment", "multi", "medical_error"), 1, null);
    expect([...v.targetPlayers]).toEqual([1, 2]);
    expect(v.targetOrgans.size).toBe(0);
  });

  it("Transplant: all candidate organs first, then only the pending organ's partners", () => {
    const t = card("t", "treatment", "multi", "transplant");
    const before = targetView(s, 0, t, 1, null);
    expect(before.targetOrgans.has("b1")).toBe(true);
    expect(before.targetOrgans.has("g2")).toBe(true);
    const after = targetView(s, 0, t, 1, ref(1, "b1"));
    // b1 (blue) may swap with g2 (green); not with mr (P1 already holds a red) nor its own owner's r1
    expect([...after.targetOrgans]).toEqual(["g2"]);
    expect(after.playMove).toBeNull();
  });
});

describe("click resolution", () => {
  const s = snap([[organ("mr", "red")], [organ("r1", "red"), organ("b1", "blue")], [organ("g2", "green")]]);

  it("virus click on a legal organ plays it there", () => {
    expect(resolveOrganClick(s, 0, card("v", "virus", "red"), null, ref(1, "r1"))).toEqual({
      type: "play",
      cardId: "v",
      targets: { player: 1, organ_id: "r1" },
    });
  });

  it("click on an illegal organ does nothing", () => {
    expect(resolveOrganClick(s, 0, card("v", "virus", "red"), null, ref(1, "b1"))).toEqual({ type: "none" });
    expect(resolveOrganClick(s, 0, null, null, ref(1, "r1"))).toEqual({ type: "none" });
  });

  it("medicine may be played on an opponent's organ", () => {
    const r = resolveOrganClick(s, 0, card("m", "medicine", "blue"), null, ref(1, "b1"));
    expect(r).toEqual({ type: "play", cardId: "m", targets: { player: 1, organ_id: "b1" } });
  });

  it("Organ Thief click steals", () => {
    const r = resolveOrganClick(s, 0, card("th", "treatment", "multi", "organ_thief"), null, ref(2, "g2"));
    expect(r).toEqual({ type: "play", cardId: "th", targets: { player: 2, organ_id: "g2" } });
  });

  it("Transplant: first click pends, same click cancels, partner click sends from/to", () => {
    const t = card("t", "treatment", "multi", "transplant");
    expect(resolveOrganClick(s, 0, t, null, ref(1, "b1"))).toEqual({ type: "pending", pending: ref(1, "b1") });
    expect(resolveOrganClick(s, 0, t, ref(1, "b1"), ref(1, "b1"))).toEqual({ type: "pending", pending: null });
    expect(resolveOrganClick(s, 0, t, ref(1, "b1"), ref(2, "g2"))).toEqual({
      type: "play",
      cardId: "t",
      targets: { from: ref(1, "b1"), to: ref(2, "g2") },
    });
    // same owner is never a partner
    expect(resolveOrganClick(s, 0, t, ref(1, "b1"), ref(1, "r1"))).toEqual({ type: "none" });
  });

  it("Medical Error: player click or a click on one of their organs", () => {
    const e = card("e", "treatment", "multi", "medical_error");
    expect(resolvePlayerClick(s, 0, e, 2)).toEqual({ type: "play", cardId: "e", targets: { player: 2 } });
    expect(resolvePlayerClick(s, 0, e, 0)).toEqual({ type: "none" });
    expect(resolveOrganClick(s, 0, e, null, ref(1, "r1"))).toEqual({ type: "play", cardId: "e", targets: { player: 1 } });
    expect(resolvePlayerClick(s, 0, card("v", "virus", "red"), 1)).toEqual({ type: "none" });
  });

  it("ghost click places the selected organ", () => {
    expect(resolveGhostClick(s, 0, card("o", "organ", "blue"))).toEqual({ type: "play", cardId: "o", targets: {} });
    expect(resolveGhostClick(s, 0, card("o", "organ", "red"))).toEqual({ type: "none" });
    expect(resolveGhostClick(s, 0, card("v", "virus", "red"))).toEqual({ type: "none" });
  });
});

describe("gameInProgress", () => {
  it("is true only while a dealt game has no winner", () => {
    expect(gameInProgress(null)).toBe(false);
    expect(gameInProgress(snap([[], []]))).toBe(true);
    expect(gameInProgress({ ...snap([[], []]), winner_idx: 1 })).toBe(false);
  });
});
