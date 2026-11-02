import { describe, expect, it } from "vitest";
import { attachEffect, canHold, colorsMatch, legalMoves, moveTargets } from "./targets";
import type { Card, Color, Organ, OrganStatus, PlayerView, Snapshot } from "./types";

let n = 0;
const card = (type: Card["type"], color: Color, treatment_kind?: Card["treatment_kind"]): Card => ({
  id: `c${n++}`,
  type,
  color,
  treatment_kind,
});
const virus = (c: Color) => card("virus", c);
const med = (c: Color) => card("medicine", c);
const treat = (k: NonNullable<Card["treatment_kind"]>) => card("treatment", "multi", k);

function organ(id: string, color: Color, attached: Card[] = []): Organ {
  const meds = attached.filter((c) => c.type === "medicine").length;
  const status: OrganStatus =
    meds >= 2 ? "immunized" : meds === 1 ? "vaccinated" : attached.length ? "infected" : "free";
  return { id, color, attached, status };
}

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

const attachIds = (s: Snapshot, c: Card) =>
  legalMoves(s, 0, c).map((m) => (m.kind === "attach" || m.kind === "thief" ? m.target.organ_id : "?"));

describe("colour matching", () => {
  it("multicolor matches anything, colours only themselves", () => {
    expect(colorsMatch("multi", "red")).toBe(true);
    expect(colorsMatch("blue", "multi")).toBe(true);
    expect(colorsMatch("red", "red")).toBe(true);
    expect(colorsMatch("red", "blue")).toBe(false);
  });
});

describe("organs", () => {
  it("a body holds 5 different organs: 4 colours + multicolor", () => {
    const four = [organ("r", "red"), organ("g", "green"), organ("b", "blue"), organ("y", "yellow")];
    expect(legalMoves(snap([four, [], []]), 0, card("organ", "multi"))).toEqual([{ kind: "organ" }]);
  });

  it("no duplicate colours, and multicolor never clashes with a coloured organ", () => {
    const body = [organ("r", "red"), organ("m", "multi")];
    expect(legalMoves(snap([body, []]), 0, card("organ", "red"))).toEqual([]);
    expect(legalMoves(snap([body, []]), 0, card("organ", "multi"))).toEqual([]);
    expect(canHold([organ("m", "multi")], "red")).toBe(true);
  });
});

describe("virus", () => {
  it("can target any player's organ of a matching colour, including your own", () => {
    const s = snap([[organ("mine", "red")], [organ("theirs", "red"), organ("blue", "blue")]]);
    expect(attachIds(s, virus("red"))).toEqual(["mine", "theirs"]);
  });

  it("on a vaccinated organ it must match the medicine's colour", () => {
    const o = organ("o", "red", [med("multi")]);
    expect(attachEffect(virus("red"), o)).toBe("neutralize");
    const plain = organ("p", "multi", [med("blue")]);
    expect(attachEffect(virus("red"), plain)).toBeNull();
    expect(attachEffect(virus("blue"), plain)).toBe("neutralize");
    expect(attachEffect(virus("multi"), plain)).toBe("neutralize");
  });

  it("infects a free organ and destroys an infected one", () => {
    expect(attachEffect(virus("green"), organ("o", "green"))).toBe("infect");
    expect(attachEffect(virus("green"), organ("o", "green", [virus("green")]))).toBe("destroy");
  });
});

describe("medicine", () => {
  it("may target any player's organ, not just your own", () => {
    const s = snap([[organ("mine", "blue")], [organ("theirs", "blue")]]);
    expect(attachIds(s, med("blue"))).toEqual(["mine", "theirs"]);
  });

  it("on an infected organ it must match the virus's colour", () => {
    const o = organ("o", "multi", [virus("red")]);
    expect(attachEffect(med("red"), o)).toBe("cure");
    expect(attachEffect(med("blue"), o)).toBeNull();
    expect(attachEffect(med("multi"), o)).toBe("cure");
  });

  it("immunize: the second medicine must match the organ's colour", () => {
    const o = organ("o", "red", [med("multi")]);
    expect(attachEffect(med("red"), o)).toBe("immunize");
    expect(attachEffect(med("multi"), o)).toBe("immunize");
    expect(attachEffect(med("blue"), o)).toBeNull();
  });
});

describe("immunized organs are never targets", () => {
  const imm = organ("imm", "red", [med("red"), med("red")]);
  it("for viruses and medicines", () => {
    expect(attachEffect(virus("red"), imm)).toBeNull();
    expect(attachEffect(med("multi"), imm)).toBeNull();
  });
  it("for Organ Thief and Transplant", () => {
    const s = snap([[organ("g", "green")], [imm]]);
    expect(legalMoves(s, 0, treat("organ_thief"))).toEqual([]);
    expect(legalMoves(s, 0, treat("transplant"))).toEqual([]);
  });
});

describe("treatments", () => {
  it("Organ Thief takes only opponents' organs you could hold", () => {
    const s = snap([[organ("mr", "red")], [organ("r", "red"), organ("b", "blue")], [organ("m", "multi")]]);
    expect(attachIds(s, treat("organ_thief"))).toEqual(["b", "m"]);
  });

  it("Transplant swaps between ANY two different players, including two opponents", () => {
    const s = snap([[], [organ("a", "red")], [organ("b", "blue")]]);
    const moves = legalMoves(s, 0, treat("transplant"));
    expect(moves).toEqual([
      { kind: "transplant", a: { player: 1, organ_id: "a" }, b: { player: 2, organ_id: "b" } },
    ]);
    expect(moveTargets(moves[0])).toEqual({ from: { player: 1, organ_id: "a" }, to: { player: 2, organ_id: "b" } });
  });

  it("Transplant can't leave a body with two organs of one colour", () => {
    const s = snap([[organ("r0", "red"), organ("b0", "blue")], [organ("b1", "blue")]]);
    const pairs = legalMoves(s, 0, treat("transplant")).map((m) => (m.kind === "transplant" ? `${m.a.organ_id}-${m.b.organ_id}` : "?"));
    // red↔blue would give player 0 two blues; blue↔blue is a fine like-for-like swap
    expect(pairs).toEqual(["b0-b1"]);
  });

  it("Medical Error targets every other player", () => {
    const moves = legalMoves(snap([[], [], [], []]), 0, treat("medical_error"));
    expect(moves.map((m) => (m.kind === "error" ? m.player : -1))).toEqual([1, 2, 3]);
  });

  it("Latex Glove and Contagion need no target", () => {
    expect(legalMoves(snap([[], []]), 0, treat("latex_glove"))).toEqual([{ kind: "instant" }]);
    expect(legalMoves(snap([[], []]), 0, treat("contagion"))).toEqual([{ kind: "instant" }]);
  });
});
