import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  BACK_FACE,
  DECK_MESHES,
  fitCamera,
  fitPoints,
  handTargets,
  sceneConfig,
  seatFrame,
  seatOf,
  tableTargets,
  tagAnchor,
} from "./layout";
import { mkCard, mkOrgan, mkSnap } from "./testSnapshots";

const faceNormal = (q: THREE.Quaternion) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);

describe("seat mapping", () => {
  it("puts the viewer at seat 0 and keeps turn order around the table", () => {
    expect(seatOf(2, 2, 4)).toBe(0);
    expect(seatOf(3, 2, 4)).toBe(1);
    expect(seatOf(0, 2, 4)).toBe(2);
    expect(seatOf(1, 2, 4)).toBe(3);
    expect(seatOf(0, 0, 6)).toBe(0);
  });

  it("seat 0 is the near side of the table", () => {
    const cfg = sceneConfig("solo", 4);
    const near = seatFrame(0, cfg).pos;
    for (let s = 1; s < 4; s++) expect(seatFrame(s, cfg).pos.z).toBeLessThan(near.z);
  });

  it("uses the wide, smaller table from 5 players on", () => {
    expect(sceneConfig("mp", 4).tableScale).toBe(0.95);
    expect(sceneConfig("mp", 5).tableScale).toBe(0.82);
    expect(sceneConfig("mp", 6).seatR).toEqual([5.0, 4.4]);
    expect(sceneConfig("solo", 4).seatR).toEqual([4.9, 4.15]);
  });
});

describe("tableTargets", () => {
  it("lays the viewer's body out at the near side whatever their index", () => {
    const snap = mkSnap(4, 2);
    snap.players[2].body = [mkOrgan("mine")];
    snap.players[0].body = [mkOrgan("theirs")];
    const tg = tableTargets(snap, sceneConfig("solo", 4), new Map());
    expect(tg.get("mine")!.pos.z).toBeGreaterThan(3);
    expect(tg.get("theirs")!.pos.z).toBeLessThan(-3);
  });

  it("centres each organ row on its seat with an even gap", () => {
    const cfg = sceneConfig("solo", 4);
    const snap = mkSnap(4);
    snap.players[0].body = [mkOrgan("a"), mkOrgan("b", "green"), mkOrgan("c", "blue")];
    const tg = tableTargets(snap, cfg, new Map());
    const xs = ["a", "b", "c"].map((id) => tg.get(id)!.pos.x);
    expect(xs[0] + xs[2]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(0);
    expect(xs[1] - xs[0]).toBeCloseTo(1.1 * cfg.tableScale);
  });

  it("tucks attachments under the organ, fanned toward the owner and face up", () => {
    const snap = mkSnap(4);
    snap.players[0].body = [mkOrgan("o", "red", [mkCard("v", "virus")], "infected")];
    const tg = tableTargets(snap, sceneConfig("solo", 4), new Map());
    const o = tg.get("o")!,
      v = tg.get("v")!;
    expect(v.pos.y).toBeLessThan(o.pos.y);
    expect(v.pos.z).toBeGreaterThan(o.pos.z); // seat 0's owner sits at +z
    expect(faceNormal(v.quat).y).toBeGreaterThan(0.9);
    expect(v.face).toBe("virus-red");
  });

  it("turns both medicines of an immunized organ face down and crossed", () => {
    const snap = mkSnap(4);
    snap.players[0].body = [mkOrgan("o", "red", [mkCard("m1", "medicine"), mkCard("m2", "medicine", "multi")], "immunized")];
    const tg = tableTargets(snap, sceneConfig("solo", 4), new Map());
    const a = tg.get("m1")!,
      b = tg.get("m2")!;
    expect(faceNormal(a.quat).y).toBeLessThan(-0.9);
    expect(faceNormal(b.quat).y).toBeLessThan(-0.9);
    expect(a.quat.angleTo(b.quat)).toBeGreaterThan(0.5);
  });

  it("stands opponents' hands as backs facing their owner", () => {
    const snap = mkSnap(4);
    const tg = tableTargets(snap, sceneConfig("solo", 4), new Map([[2, ["x", "y", "z"]]]));
    const y = tg.get("y")!;
    expect(y.face).toBe(BACK_FACE);
    // seat 2 is across the table: its owner is at -z, so the card front faces -z (the viewer sees the back)
    expect(faceNormal(y.quat).z).toBeLessThan(-0.9);
  });

  it("caps the deck meshes and shows the discard top face up", () => {
    const snap = mkSnap(2, 0, { deck_count: 60, discard_count: 5, discard_top: mkCard("top", "treatment", "multi", "organ_thief") });
    const tg = tableTargets(snap, sceneConfig("solo", 2), new Map());
    expect([...tg.keys()].filter((k) => k.startsWith("deck:")).length).toBe(DECK_MESHES);
    expect([...tg.keys()].filter((k) => k.startsWith("disc:")).length).toBe(4);
    expect(tg.get("top")!.face).toBe("treatment-thief");
    expect(faceNormal(tg.get("top")!.quat).y).toBeGreaterThan(0.9);
  });
});

describe("camera fit", () => {
  const fitted = (w: number, h: number, n = 4) => {
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const cfg = sceneConfig(n >= 5 ? "mp" : "solo", n);
    return { cam, cfg, fit: fitCamera(cam, w, h, cfg) };
  };

  it("keeps every fit point inside the band between top padding and hand", () => {
    for (const [w, h, n] of [
      [1280, 800, 4],
      [1600, 900, 5],
      [420, 820, 4],
      [900, 700, 6],
    ]) {
      const { cam, cfg, fit } = fitted(w, h, n);
      const handTop = fit.handTopFrac * 2 - 1;
      for (const p of fitPoints(cfg)) {
        const v = p.clone().project(cam);
        expect(v.y).toBeLessThanOrEqual(1);
        expect(v.y).toBeGreaterThan(handTop - 0.05);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never pulls the camera back as the canvas gets wider", () => {
    let prev = Infinity;
    for (let w = 900; w <= 2400; w += 100) {
      const d = fitted(w, 800).fit.distance;
      expect(d).toBeLessThanOrEqual(prev + 1e-6);
      prev = d;
    }
  });

  it("fans the hand symmetrically below the table", () => {
    const { cam, cfg } = fitted(1280, 800);
    const hand = handTargets([mkCard("a"), mkCard("b"), mkCard("c")], cam, cfg);
    const sx = ["a", "b", "c"].map((id) => hand.targets.get(id)!.pos.clone().project(cam));
    expect(sx[0].x + sx[2].x).toBeCloseTo(0, 3);
    expect(sx[1].y).toBeLessThan(-0.4);
    expect(hand.targets.get("a")!.hand).toBe(true);
  });
});

describe("seat tags", () => {
  it("hangs the end seats' tags beside the table only on wide canvases", () => {
    const cfg = sceneConfig("solo", 4);
    expect(tagAnchor(1, cfg, 1280).side).toBe(1);
    expect(tagAnchor(3, cfg, 1280).side).toBe(-1);
    expect(tagAnchor(2, cfg, 1280).side).toBe(0);
    expect(tagAnchor(1, cfg, 600).side).toBe(0);
  });
});
