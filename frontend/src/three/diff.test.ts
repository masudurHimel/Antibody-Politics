import { describe, expect, it } from "vitest";
import { diffFlair, diffHeroes, locateCards, nextOppHand } from "./diff";
import { mkCard, mkOrgan, mkSnap } from "./testSnapshots";
import type { Snapshot } from "../game/types";

const clone = (s: Snapshot): Snapshot => structuredClone(s);

describe("diffHeroes", () => {
  it("viewer's heroes are the cards that left the hand", () => {
    const prev = mkSnap(4);
    const next = clone(prev);
    const played = next.players[0].hand!.shift()!;
    next.players[0].body.push(mkOrgan(played.id));
    next.players[0].hand!.push(mkCard("drawn"));
    const r = diffHeroes(prev, next, { player: 0, kind: "play", seq: 1 });
    expect([...r.heroes]).toEqual([played.id]);
    expect(r.spawnFrom.size).toBe(0);
  });

  it("an opponent's heroes are new ids on the table or discard top, spawned from their hand", () => {
    const prev = mkSnap(4);
    prev.players[1].body = [mkOrgan("o1")];
    const next = clone(prev);
    next.players[1].body[0].attached.push(mkCard("v9", "virus"));
    next.players[2].body.push(mkOrgan("o2"));
    next.discard_top = mkCard("t1", "treatment", "multi", "contagion");
    const r = diffHeroes(prev, next, { player: 2, kind: "play", seq: 4 });
    expect(new Set(r.heroes)).toEqual(new Set(["v9", "o2", "t1"]));
    expect(r.spawnFrom.get("o2")).toBe(2);
  });

  it("organs moving between bodies are not heroes", () => {
    const prev = mkSnap(3);
    prev.players[0].body = [mkOrgan("x")];
    const next = clone(prev);
    next.players[1].body = next.players[0].body;
    next.players[0].body = [];
    next.discard_top = mkCard("thief", "treatment", "multi", "organ_thief");
    const r = diffHeroes(prev, next, { player: 1, kind: "play", seq: 2 });
    expect([...r.heroes]).toEqual(["thief"]);
  });

  it("no action, a pass or the first snapshot have no heroes", () => {
    const s = mkSnap(2);
    expect(diffHeroes(null, s, { player: 0, kind: "play", seq: 1 }).heroes.size).toBe(0);
    expect(diffHeroes(s, clone(s), null).heroes.size).toBe(0);
    expect(diffHeroes(s, clone(s), { player: 1, kind: "pass", seq: 1 }).heroes.size).toBe(0);
  });
});

describe("diffFlair", () => {
  const withOrgan = (status: Snapshot["players"][0]["body"][0]["status"]) => {
    const s = mkSnap(2);
    s.players[1].body = [mkOrgan("o", "red", [], status)];
    return s;
  };
  const kinds = (a: Snapshot, b: Snapshot) => diffFlair(a, b).map((e) => e.kind);

  it.each([
    ["free", "infected", "infect"],
    ["vaccinated", "free", "neutralize"],
    ["infected", "free", "cure"],
    ["free", "vaccinated", "vaccinate"],
    ["vaccinated", "immunized", "immunize"],
  ] as const)("%s → %s is %s", (from, to, kind) => {
    expect(diffFlair(withOrgan(from), withOrgan(to))).toEqual([{ kind, organId: "o" }]);
  });

  it("an organ that disappeared was destroyed", () => {
    const next = withOrgan("free");
    next.players[1].body = [];
    expect(diffFlair(withOrgan("infected"), next)).toEqual([{ kind: "destroy", organId: "o" }]);
  });

  it("a stolen organ keeps its status and makes no flair", () => {
    const prev = withOrgan("vaccinated");
    const next = clone(prev);
    next.players[0].body = next.players[1].body;
    next.players[1].body = [];
    expect(diffFlair(prev, next)).toEqual([]);
  });

  it("detects a Medical Error body swap", () => {
    const prev = mkSnap(3);
    prev.players[0].body = [mkOrgan("a1"), mkOrgan("a2", "blue")];
    prev.players[2].body = [mkOrgan("c1", "green")];
    const next = clone(prev);
    [next.players[0].body, next.players[2].body] = [next.players[2].body, next.players[0].body];
    next.discard_top = mkCard("err", "treatment", "multi", "medical_error");
    expect(kinds(prev, next)).toEqual(["swap"]);
    // the same rearrangement without a Medical Error on the pile is a transplant, not a body swap
    next.discard_top = mkCard("tp", "treatment", "multi", "transplant");
    expect(kinds(prev, next)).toEqual([]);
  });

  it("detects a Latex Glove wiping every other hand", () => {
    const prev = mkSnap(4);
    const next = clone(prev);
    for (const i of [1, 2, 3]) next.players[i].hand_count = 0;
    expect(kinds(prev, next)).toEqual(["wipe"]);
    const partial = clone(prev);
    partial.players[1].hand_count = 0;
    expect(kinds(prev, partial)).toEqual([]);
  });

  it("is silent across games", () => {
    const next = withOrgan("infected");
    next.game_id = "other";
    expect(diffFlair(withOrgan("free"), next)).toEqual([]);
  });
});

describe("locateCards", () => {
  it("marks immunized medicines as face down", () => {
    const s = mkSnap(2);
    s.players[1].body = [mkOrgan("o", "red", [mkCard("m1", "medicine"), mkCard("m2", "medicine")], "immunized")];
    const loc = locateCards(s);
    expect(loc.get("m1")).toEqual({ kind: "organ", player: 1, organId: "o", attached: true, faceDown: true });
    expect(loc.get("h0-0")).toEqual({ kind: "hand" });
  });
});

describe("nextOppHand", () => {
  let n = 0;
  const id = () => `n${n++}`;

  it("consumes the played cards and draws fresh ids back up", () => {
    n = 0;
    const r = nextOppHand(["a", "b", "c"], 3, 1, id);
    expect(r.consumed).toEqual(["c"]);
    expect(r.ids).toEqual(["a", "b", "n0"]);
  });

  it("drops extras when the hand shrinks (Latex Glove)", () => {
    const r = nextOppHand(["a", "b", "c"], 0, 0, id);
    expect(r.ids).toEqual([]);
    expect(r.consumed).toEqual([]);
  });
});
