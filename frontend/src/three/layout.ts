// Pure table geometry (ported from the v2 mock's seatFrame / toWorld / computeTargets / handTargets / fitCamera).
// Only THREE math types are used, so everything here runs (and is tested) without WebGL.
import * as THREE from "three";
import type { Card, Snapshot } from "../game/types";
import type { Mode } from "./contract";
import { cardKey, hash, rng } from "../cards/textures";

const TAU = Math.PI * 2;

export interface SceneConfig {
  n: number;
  tableScale: number;
  seatR: [number, number];
  camPos: [number, number, number];
  look: [number, number, number];
  fov: number;
  fovNarrow: number;
  topPad: number;
  handDist: number;
  handH: number;
  handW: number;
  handY: number;
  anim: { dur: number; arc: number; stagger: number };
}

/** Geometry follows the player count (5+ seats get the wider, smaller table); pacing follows the mode. */
export function sceneConfig(mode: Mode, n: number): SceneConfig {
  const wide = n >= 5;
  return {
    n,
    tableScale: wide ? 0.82 : 0.95,
    seatR: wide ? [5.0, 4.4] : [4.9, 4.15],
    camPos: [0, 11, 9],
    look: [0, 0, 0],
    fov: 38,
    fovNarrow: 52,
    topPad: 34,
    handDist: 4.2,
    handH: 0.3,
    handW: 0.5,
    handY: 0.62,
    anim: mode === "solo" ? { dur: 660, arc: 1.5, stagger: 85 } : { dur: 540, arc: 1.3, stagger: 70 },
  };
}

/** what a card mesh should show on its front: a type key, or the shared back for anonymous / pile cards */
export type Face = string;
export const BACK_FACE = "back";

export interface Target {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  s: number;
  face: Face;
  /** viewer's hand: camera-space, unlit */
  hand?: boolean;
}

export const UP = new THREE.Vector3(0, 1, 0);
export const Q_FLAT_UP = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
export const Q_FLAT_DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
export const DECK_POS = new THREE.Vector3(-0.85, 0, 0);
export const DISC_POS = new THREE.Vector3(0.85, 0, 0);
/** at most this many meshes stand in for the face-down deck */
export const DECK_MESHES = 20;
/** at most this many backs give the discard pile its height */
export const DISCARD_FILLERS = 8;

export const rotY = (a: number) => new THREE.Quaternion().setFromAxisAngle(UP, a);
export const rotX = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
export const rotZ = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
export const jitter = (id: string, amt: number) => (rng(hash(id))() - 0.5) * amt;

/** table seat of a player: the viewer is always seat 0, at the near side */
export function seatOf(player: number, viewer: number, n: number): number {
  return (((player - viewer) % n) + n) % n;
}

export function seatFrame(seat: number, cfg: SceneConfig) {
  const th = (seat / cfg.n) * TAU;
  return {
    pos: new THREE.Vector3(Math.sin(th) * cfg.seatR[0], 0, Math.cos(th) * cfg.seatR[1]),
    quat: new THREE.Quaternion().setFromAxisAngle(UP, th),
    th,
  };
}

export function toWorld(seat: number, cfg: SceneConfig, local: THREE.Vector3, localQuat: THREE.Quaternion) {
  const f = seatFrame(seat, cfg);
  return { pos: local.clone().applyQuaternion(f.quat).add(f.pos), quat: f.quat.clone().multiply(localQuat) };
}

/** x offset of slot j in a centred row of n organs */
export function slotLocal(n: number, j: number, cfg: SceneConfig): THREE.Vector3 {
  return new THREE.Vector3((j - (n - 1) / 2) * 1.1 * cfg.tableScale, 0, 0);
}

export const deckId = (i: number) => `deck:${i}`;
export const discardFillerId = (i: number) => `disc:${i}`;
export const isPileFiller = (id: string) => id.startsWith("deck:") || id.startsWith("disc:");

export function deckTopY(deckCount: number): number {
  return 0.01 + Math.max(0, deckCount - 1) * 0.006 + 0.006;
}

export function discardTopTransform(snap: Snapshot, id: string, cfg: SceneConfig) {
  const y = 0.01 + Math.max(0, snap.discard_count - 1) * 0.006 + 0.004;
  return {
    pos: DISC_POS.clone().add(new THREE.Vector3(jitter(id + "x", 0.12), y, jitter(id + "z", 0.12))),
    quat: rotY(jitter(id, 0.5)).multiply(Q_FLAT_UP),
    s: cfg.tableScale,
  };
}

/** standing card backs facing their owner, `slot` of `count` */
export function oppHandTransform(seat: number, slot: number, count: number, cfg: SceneConfig) {
  const ts = cfg.tableScale,
    off = slot - (count - 1) / 2;
  const l = new THREE.Vector3(off * 0.5 * ts, 0.72 * ts, 1.95 + Math.abs(off) * 0.05);
  return { ...toWorld(seat, cfg, l, rotX(0.18).multiply(rotZ(-off * 0.12))), s: ts * 0.82 };
}

/**
 * Every table card's target (piles, bodies, opponents' standing hands). The viewer's hand is camera-space and
 * comes from `handTargets`. `oppHands` holds the anonymous mesh ids standing in for each opponent's hand.
 */
export function tableTargets(snap: Snapshot, cfg: SceneConfig, oppHands: Map<number, string[]>): Map<string, Target> {
  const tg = new Map<string, Target>(),
    ts = cfg.tableScale,
    n = snap.players.length;

  const deckN = Math.min(DECK_MESHES, snap.deck_count);
  const deckStep = deckN > 1 ? ((snap.deck_count - 1) * 0.006) / (deckN - 1) : 0;
  for (let i = 0; i < deckN; i++) {
    const id = deckId(i);
    tg.set(id, {
      pos: DECK_POS.clone().add(new THREE.Vector3(0, 0.01 + i * deckStep, 0)),
      quat: Q_FLAT_DOWN.clone().multiply(rotZ(jitter(id, 0.06))),
      s: ts,
      face: BACK_FACE,
    });
  }

  const below = Math.max(0, snap.discard_count - (snap.discard_top ? 1 : 0));
  const fillN = Math.min(DISCARD_FILLERS, below);
  const fillStep = fillN > 1 ? ((below - 1) * 0.006) / (fillN - 1) : 0;
  for (let i = 0; i < fillN; i++) {
    const id = discardFillerId(i);
    tg.set(id, {
      pos: DISC_POS.clone().add(new THREE.Vector3(jitter(id + "x", 0.12), 0.01 + i * fillStep, jitter(id + "z", 0.12))),
      quat: rotY(jitter(id, 0.5)).multiply(Q_FLAT_DOWN),
      s: ts,
      face: BACK_FACE,
    });
  }
  if (snap.discard_top) tg.set(snap.discard_top.id, { ...discardTopTransform(snap, snap.discard_top.id, cfg), face: cardKey(snap.discard_top) });

  snap.players.forEach((P, p) => {
    const seat = seatOf(p, snap.viewer_idx, n);
    const rowN = P.body.length;
    P.body.forEach((organ, j) => {
      const base = slotLocal(rowN, j, cfg);
      tg.set(organ.id, {
        ...toWorld(seat, cfg, base.clone().setY(0.04), Q_FLAT_UP),
        s: ts,
        face: cardKey({ type: "organ", color: organ.color }),
      });
      const imm = organ.status === "immunized";
      organ.attached.forEach((c, k) => {
        // tucked under the organ and fanned toward its owner, so the organ art stays fully visible
        const l = base.clone().add(new THREE.Vector3((k ? -0.1 : 0.1) * ts, 0.026 - k * 0.01, (imm ? 0.5 : 0.5 + 0.3 * k) * ts));
        const q = imm ? rotY(k ? -0.3 : 0.3).multiply(Q_FLAT_DOWN) : Q_FLAT_UP.clone();
        tg.set(c.id, { ...toWorld(seat, cfg, l, q), s: ts, face: cardKey(c) });
      });
    });
    if (p === snap.viewer_idx) return;
    const ids = oppHands.get(p) ?? [];
    ids.forEach((id, i) => tg.set(id, { ...oppHandTransform(seat, i, ids.length, cfg), face: BACK_FACE }));
  });
  return tg;
}

export function ghostTransform(bodyLen: number, cfg: SceneConfig) {
  const n = bodyLen + 1;
  return { ...toWorld(0, cfg, slotLocal(n, n - 1, cfg).setY(0.006), Q_FLAT_UP), s: cfg.tableScale };
}

/** translucent whole-body target zone of a seat (Medical Error) */
export function zoneTransform(seat: number, cfg: SceneConfig) {
  const t = toWorld(seat, cfg, new THREE.Vector3(0, 0.004, 0.2), Q_FLAT_UP);
  return { ...t, scale: new THREE.Vector3(6.2 * cfg.tableScale, 2.4 * cfg.tableScale, 1) };
}

/* ---------------- camera-space hand ---------------- */

function ndcToWorld(cam: THREE.PerspectiveCamera, x: number, y: number, d: number) {
  const v = new THREE.Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  return cam.position.clone().add(v.multiplyScalar(d / v.dot(fwd)));
}

export interface HandLayout {
  targets: Map<string, Target>;
  /** world-space card scale of the hand */
  hs: number;
  /** hover lift distance (selected cards lift 1.4×) */
  lift: number;
}

/** fanned hand in camera space; `cam` must already be fitted */
export function handTargets(hand: Card[], cam: THREE.PerspectiveCamera, cfg: SceneConfig): HandLayout {
  const d = cfg.handDist,
    halfH = d * Math.tan((cam.fov * Math.PI) / 360),
    halfW = halfH * cam.aspect;
  const hs = Math.min(halfH * cfg.handH, halfW * cfg.handW);
  const chN = (1.4 * hs) / halfH;
  const cy = -1 + chN * cfg.handY;
  const n = hand.length,
    targets = new Map<string, Target>();
  hand.forEach((c, i) => {
    const off = i - (n - 1) / 2;
    const x = (off * 1.06 * hs) / halfW;
    const y = cy - Math.abs(off) * 0.025;
    targets.set(c.id, {
      pos: ndcToWorld(cam, x, y, d + i * 0.002),
      quat: cam.quaternion.clone().multiply(rotZ(-off * 0.09)),
      s: hs,
      face: cardKey(c),
      hand: true,
    });
  });
  return { targets, hs, lift: hs * 0.32 };
}

/* ---------------- camera fit ---------------- */

/** every point that must stay on screen: each body row (with attachments), opponents' hands and tags, the piles */
export function fitPoints(cfg: SceneConfig): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [],
    ts = cfg.tableScale,
    half = 2.2 * 1.1 * ts + 0.5 * ts;
  const add = (seat: number, x: number, y: number, z: number) => pts.push(toWorld(seat, cfg, new THREE.Vector3(x, y, z), Q_FLAT_UP).pos);
  for (let seat = 0; seat < cfg.n; seat++) {
    for (const x of [-half, half]) {
      add(seat, x, 0, -0.75 * ts);
      add(seat, x, 0, 1.5 * ts);
    }
    if (seat === 0) continue;
    add(seat, -0.9, 1.45 * ts, 1.95);
    add(seat, 0.9, 1.45 * ts, 1.95);
    add(seat, 0, 1.75 * ts + 1, 2.1);
  }
  pts.push(DECK_POS.clone(), DISC_POS.clone());
  return pts;
}

export interface FitResult {
  distance: number;
  /** top of the hand band as a fraction of canvas height from the bottom */
  handTopFrac: number;
}

/**
 * Pulls the camera back along its fixed angle until the table fits between the top padding and the hand band,
 * then shifts the image vertically so it sits centred in that band. `hintPx` reserves room above the hand.
 */
export function fitCamera(cam: THREE.PerspectiveCamera, w: number, h: number, cfg: SceneConfig, hintPx = 32): FitResult {
  cam.aspect = w / h;
  cam.fov = cam.aspect < 1 ? cfg.fovNarrow : cfg.fov;
  cam.clearViewOffset();
  const look = new THREE.Vector3(...cfg.look),
    dir = new THREE.Vector3(...cfg.camPos).sub(look).normalize();
  const chN = 1.4 * Math.min(cfg.handH, cam.aspect * cfg.handW);
  const handTopN = -1 + chN * cfg.handY + chN / 2;
  const yb = handTopN + ((hintPx + 16) / h) * 2;
  // the side margin keeps room for the end seats' name tags
  const yt = 1 - ((cfg.topPad + (w <= 640 ? 58 : 0)) / h) * 2,
    xl = 1 - ((28 + (w > 640 ? 200 : 0)) / w) * 2;
  const pts = fitPoints(cfg);
  const v = new THREE.Vector3();
  const place = (d: number) => {
    cam.position.copy(look).addScaledVector(dir, d);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };
  const span = () => {
    let y0 = Infinity,
      y1 = -Infinity,
      x = 0;
    for (const p of pts) {
      v.copy(p).project(cam);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
      x = Math.max(x, Math.abs(v.x));
    }
    return { y0, y1, x };
  };
  let lo = 3,
    hi = 120;
  for (let i = 0; i < 32; i++) {
    const d = (lo + hi) / 2;
    place(d);
    const s = span();
    if (s.y1 - s.y0 <= yt - yb && s.x <= xl) hi = d;
    else lo = d;
  }
  place(hi);
  const s = span();
  cam.setViewOffset(w, h, 0, (((yt + yb) / 2 - (s.y0 + s.y1) / 2) * h) / 2, w, h);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return { distance: hi, handTopFrac: (handTopN + 1) / 2 + 0.02 };
}

/* ---------------- seat tags ---------------- */

export interface TagAnchor {
  pos: THREE.Vector3;
  /** -1 = beside the table on the left, 1 = on the right, 0 = above the seat */
  side: -1 | 0 | 1;
}

/** where a seat's name tag hangs: beside the rim for the table's left/right ends on wide canvases, else above its hand */
export function tagAnchor(seat: number, cfg: SceneConfig, canvasW: number): TagAnchor {
  const f = seatFrame(seat, cfg),
    out = new THREE.Vector3(Math.sin(f.th), 0, Math.cos(f.th));
  const side = (canvasW > 640 && Math.abs(out.x) > 0.8 ? Math.sign(out.x) : 0) as -1 | 0 | 1;
  const pos = side
    ? f.pos.clone().addScaledVector(out, 2.9).setY(0.4)
    : f.pos.clone().addScaledVector(out, 2.1).setY(1.75 * cfg.tableScale);
  return { pos, side };
}
