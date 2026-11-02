// Imperative half of the table: owns one mesh group per card id, tweens them toward their layout targets,
// draws highlights, picks under the pointer and plays the flair. TableScene drives it from React.
import * as THREE from "three";
import type { Snapshot } from "../game/types";
import { getBackTexture, getTextureForKey } from "../cards/textures";
import {
  BACK_FACE,
  DECK_POS,
  Q_FLAT_DOWN,
  UP,
  deckTopY,
  discardTopTransform,
  ghostTransform,
  handTargets,
  isPileFiller,
  oppHandTransform,
  seatOf,
  tableTargets,
  zoneTransform,
  type Face,
  type SceneConfig,
  type Target,
} from "./layout";
import { FLAIR_COLOR, FLAIR_WORD, locateCards, nextOppHand, type CardLoc, type FlairEvent, type Heroes } from "./diff";
import { EASE, type EaseName } from "./ease";

/** The approved mock ran three r149 in legacy colour mode, where hex colours were used as linear values.
 *  Lights, glows and the rim keep that look by being declared linear here. */
export const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
const AMBER = lin(0xf2c14e);

function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rrGeo(w: number, h: number, r: number) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 6);
  const p = g.attributes.position,
    uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

/* shared across every card: three geometries, two materials per face (lit table / unlit hand), two glows */
const GEO = { card: rrGeo(1, 1.4, 0.085), glow: rrGeo(1.14, 1.54, 0.14), zone: rrGeo(1, 1, 0.2) };
const litMats = new Map<Face, THREE.MeshStandardMaterial>();
const unlitMats = new Map<Face, THREE.MeshBasicMaterial>();
function faceTexture(face: Face) {
  return face === BACK_FACE ? getBackTexture() : getTextureForKey(face);
}
function faceMaterial(face: Face, unlit: boolean): THREE.Material {
  if (unlit) {
    let m = unlitMats.get(face);
    if (!m) unlitMats.set(face, (m = new THREE.MeshBasicMaterial({ map: faceTexture(face) })));
    return m;
  }
  let m = litMats.get(face);
  if (!m) litMats.set(face, (m = new THREE.MeshStandardMaterial({ map: faceTexture(face), roughness: face === BACK_FACE ? 0.6 : 0.55 })));
  return m;
}
const glowPulse = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false });
const glowSolid = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.95, depthWrite: false });

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  s: number;
}
interface Tween {
  p0: THREE.Vector3;
  q0: THREE.Quaternion;
  s0: number;
  t0: number;
  dur: number;
  arc: number;
  ease: EaseName;
}

class CardObj {
  readonly group = new THREE.Group();
  readonly front: THREE.Mesh;
  readonly back: THREE.Mesh;
  readonly glow: THREE.Mesh;
  /** un-lifted, un-shaken transform */
  readonly cur: Pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1 };
  tgt: Target | null = null;
  tw: Tween | null = null;
  face: Face = "";
  unlit = false;
  lift = 0;
  /** 0 while on the table; otherwise the time it is removed (it is flying to the discard pile) */
  leaveAt = 0;
  shakeUntil = 0;

  constructor(readonly id: string) {
    this.front = new THREE.Mesh(GEO.card, faceMaterial(BACK_FACE, false));
    this.back = new THREE.Mesh(GEO.card, faceMaterial(BACK_FACE, false));
    this.back.rotation.y = Math.PI;
    this.back.position.z = -0.004;
    this.glow = new THREE.Mesh(GEO.glow, glowSolid);
    this.glow.position.z = -0.002;
    this.glow.visible = false;
    this.front.userData.cardId = this.back.userData.cardId = id;
    this.front.userData.front = true;
    this.group.add(this.glow, this.front, this.back);
  }

  setPose(p: Pose) {
    this.cur.pos.copy(p.pos);
    this.cur.quat.copy(p.quat);
    this.cur.s = p.s;
  }

  setFace(face: Face, unlit: boolean) {
    if (face === this.face && unlit === this.unlit) return;
    this.face = face;
    this.unlit = unlit;
    this.front.material = faceMaterial(face, unlit);
    this.front.castShadow = this.back.castShadow = !unlit;
    this.front.receiveShadow = !unlit;
  }
}

export interface Highlights {
  selection: ReadonlySet<string>;
  targetOrgans: ReadonlySet<string>;
  pendingOrgan: string | null;
  targetPlayers: ReadonlySet<number>;
  showGhost: boolean;
  interactive: boolean;
}

export type PickHit =
  | { kind: "card"; id: string; front: boolean }
  | { kind: "ghost" }
  | { kind: "zone"; player: number };

export interface SyncOptions {
  instant: boolean;
  heroes?: Heroes;
  flair?: FlairEvent[];
  /** animation pace multiplier */
  speed: number;
}

interface Fx {
  t0: number;
  life: number;
  step(k: number, dt: number): void;
  dispose(): void;
}

export class CardTable {
  readonly root = new THREE.Group();
  calloutLayer: HTMLElement | null = null;
  hl: Highlights = {
    selection: new Set(),
    targetOrgans: new Set(),
    pendingOrgan: null,
    targetPlayers: new Set(),
    showGhost: false,
    interactive: false,
  };
  hoverId: string | null = null;
  /** face-known cards of the current snapshot, by id */
  locs = new Map<string, CardLoc>();

  private objs = new Map<string, CardObj>();
  private oppHands = new Map<number, string[]>();
  private oppSerial = 0;
  private ghost: THREE.Mesh;
  private zoneMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false });
  private zones: { player: number; mesh: THREE.Mesh }[] = [];
  private zoneKey = "";
  private handLift = 0.2;
  private snap: Snapshot | null = null;
  private cfg: SceneConfig | null = null;
  private fx: Fx[] = [];
  private pendingFlair: { at: number; ev: FlairEvent; pos?: THREE.Vector3 }[] = [];
  private callouts: { el: HTMLElement; anchor: THREE.Vector3 }[] = [];
  private tmp = new THREE.Vector3();

  constructor() {
    this.ghost = new THREE.Mesh(GEO.card, new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false }));
    this.ghost.visible = false;
    this.root.add(this.ghost);
  }

  /** lays every card out for `snap`; animated unless `instant` (first frame, resize, new game) */
  sync(snap: Snapshot, cam: THREE.PerspectiveCamera, cfg: SceneConfig, opts: SyncOptions) {
    const prev = this.snap;
    const newGame = !prev || prev.game_id !== snap.game_id || prev.viewer_idx !== snap.viewer_idx || prev.players.length !== snap.players.length;
    const instant = opts.instant || newGame;
    if (newGame) this.clear();
    this.snap = snap;
    this.cfg = cfg;
    this.locs = locateCards(snap);
    this.buildZones(snap, cfg);

    const heroes = instant ? null : opts.heroes ?? null;
    const n = snap.players.length;

    // anonymous opponent hands: cards that became heroes leave the hand; draws get fresh ids
    const consumed = new Map<number, CardObj[]>();
    snap.players.forEach((P, p) => {
      if (p === snap.viewer_idx) return;
      let used = 0;
      if (heroes) for (const who of heroes.spawnFrom.values()) if (who === p) used++;
      const r = nextOppHand(this.oppHands.get(p) ?? [], P.hand_count, used, () => `opp:${p}:${this.oppSerial++}`);
      this.oppHands.set(p, r.ids);
      consumed.set(p, r.consumed.map((id) => this.objs.get(id)).filter((o): o is CardObj => !!o));
      for (const id of r.consumed) this.objs.delete(id);
    });

    const targets = tableTargets(snap, cfg, this.oppHands);
    const hand = handTargets(snap.players[snap.viewer_idx]?.hand ?? [], cam, cfg);
    this.handLift = hand.lift;
    for (const [id, t] of hand.targets) targets.set(id, t);

    const now = performance.now();
    const dur = cfg.anim.dur * opts.speed * (REDUCED ? 0.35 : 1);
    const prevDeck = prev?.deck_count ?? snap.deck_count;
    const deckTop: Pose = { pos: DECK_POS.clone().setY(deckTopY(prevDeck)), quat: Q_FLAT_DOWN.clone(), s: cfg.tableScale };

    // destroyed organs burst where they were, before they start flying away
    const flair = opts.flair ?? [];
    const firedAt = now + dur * 0.7;
    for (const ev of flair) {
      const at = ev.organId ? this.objs.get(ev.organId) : undefined;
      this.pendingFlair.push({ at: firedAt, ev, pos: ev.kind === "destroy" && at ? at.cur.pos.clone() : undefined });
    }

    let k = 0;
    for (const [id, t] of targets) {
      let obj = this.objs.get(id);
      const fresh = !obj;
      if (!obj) {
        obj = new CardObj(id);
        this.objs.set(id, obj);
        this.root.add(obj.group);
        const from = heroes?.spawnFrom.get(id);
        if (instant) obj.setPose(t);
        else if (from !== undefined) {
          const stand = consumed.get(from)?.pop();
          if (stand) {
            obj.setPose(stand.cur);
            this.removeObj(stand);
          } else {
            const ids = this.oppHands.get(from) ?? [];
            obj.setPose(oppHandTransform(seatOf(from, snap.viewer_idx, n), (ids.length - 1) / 2, Math.max(1, ids.length), cfg));
          }
        } else if (t.hand || id.startsWith("opp:")) obj.setPose(deckTop);
        else obj.setPose(t);
      }
      obj.leaveAt = 0;
      obj.setFace(t.face, !!t.hand);
      const prevT = obj.tgt;
      obj.tgt = t;
      if (instant) {
        obj.tw = null;
        obj.setPose(t);
        continue;
      }
      if (!fresh && prevT && samePose(prevT, t)) continue;
      if (fresh && !heroes?.heroes.has(id) && obj.cur.pos.distanceTo(t.pos) < 0.002) continue;
      const hero = !!heroes?.heroes.has(id);
      const delay = hero ? 0 : Math.min(k++, 12) * cfg.anim.stagger * opts.speed;
      obj.tw = this.tweenFrom(obj, now + delay, dur, hero ? cfg.anim.arc : 0, hero ? "back" : "cubic");
    }
    for (const list of consumed.values()) for (const o of list) this.removeObj(o);

    // cards that left the table (cured, destroyed, discarded under the top, wiped hands) fly onto the discard pile
    let h = 1;
    for (const obj of [...this.objs.values()]) {
      if (targets.has(obj.id) || obj.leaveAt) continue;
      if (isPileFiller(obj.id) || instant) {
        this.removeObj(obj);
        continue;
      }
      const top = discardTopTransform(snap, obj.id, cfg);
      top.pos.y -= 0.003;
      obj.tgt = { ...top, face: obj.face };
      obj.setFace(obj.face, false);
      // the other cards of a multi-discard arc together with the one that lands on top
      const hero = !!heroes?.heroes.has(obj.id);
      const delay = hero ? Math.min(h++, 4) * cfg.anim.stagger * 0.5 * opts.speed : Math.min(k++, 12) * cfg.anim.stagger * opts.speed;
      obj.tw = this.tweenFrom(obj, now + delay, dur, hero ? cfg.anim.arc : 0, hero ? "back" : "cubic");
      obj.leaveAt = now + delay + dur;
    }
  }

  private tweenFrom(obj: CardObj, t0: number, dur: number, arc: number, ease: EaseName): Tween {
    return { p0: obj.cur.pos.clone(), q0: obj.cur.quat.clone(), s0: obj.cur.s, t0, dur, arc, ease };
  }

  private buildZones(snap: Snapshot, cfg: SceneConfig) {
    const key = `${snap.players.length}:${snap.viewer_idx}:${cfg.tableScale}`;
    if (key === this.zoneKey) return;
    this.zoneKey = key;
    for (const z of this.zones) this.root.remove(z.mesh);
    this.zones = snap.players.map((_, p) => {
      const t = zoneTransform(seatOf(p, snap.viewer_idx, snap.players.length), cfg);
      const mesh = new THREE.Mesh(GEO.zone, this.zoneMat);
      mesh.position.copy(t.pos);
      mesh.quaternion.copy(t.quat);
      mesh.scale.copy(t.scale);
      mesh.userData.zone = p;
      mesh.visible = false;
      this.root.add(mesh);
      return { player: p, mesh };
    });
  }

  private removeObj(obj: CardObj) {
    this.root.remove(obj.group);
    if (this.objs.get(obj.id) === obj) this.objs.delete(obj.id);
  }

  private clear() {
    for (const o of [...this.objs.values()]) this.removeObj(o);
    this.oppHands.clear();
    for (const f of this.fx) f.dispose();
    this.fx = [];
    this.pendingFlair = [];
  }

  /** world position of a card (for overlays); null when it is not on the table */
  positionOf(id: string): THREE.Vector3 | null {
    return this.objs.get(id)?.cur.pos ?? null;
  }

  frame(now: number, dt: number, cam: THREE.PerspectiveCamera) {
    const camUp = this.tmp.copy(UP).applyQuaternion(cam.quaternion).clone();
    const pulse = 0.55 + 0.35 * Math.sin(now / 160);
    const { selection, targetOrgans, pendingOrgan, targetPlayers, showGhost, interactive } = this.hl;

    for (const obj of [...this.objs.values()]) {
      if (obj.leaveAt && now >= obj.leaveAt) {
        this.removeObj(obj);
        continue;
      }
      const t = obj.tgt;
      if (!t) continue;
      const tw = obj.tw;
      if (tw) {
        const k = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
        const e = EASE[tw.ease](k);
        obj.cur.pos.lerpVectors(tw.p0, t.pos, e).addScaledVector(UP, tw.arc * Math.sin(Math.PI * k));
        obj.cur.quat.slerpQuaternions(tw.q0, t.quat, Math.min(1, e));
        obj.cur.s = tw.s0 + (t.s - tw.s0) * Math.min(1, e);
        if (k >= 1) obj.tw = null;
      } else obj.setPose(t);

      const loc = obj.leaveAt ? undefined : this.locs.get(obj.id);
      let hl = 0;
      if (loc?.kind === "hand" && selection.has(obj.id)) hl = 2;
      else if (loc?.kind === "organ" && !loc.attached) {
        if (pendingOrgan === obj.id) hl = 2;
        else if (targetOrgans.has(obj.id)) hl = 1;
      }
      const inHand = loc?.kind === "hand";
      const want = inHand && interactive ? (hl === 2 ? 1.4 : this.hoverId === obj.id ? 1 : 0) : 0;
      obj.lift += (want - obj.lift) * Math.min(1, dt * 14);

      const g = obj.group;
      g.position.copy(obj.cur.pos);
      g.quaternion.copy(obj.cur.quat);
      g.scale.setScalar(obj.cur.s);
      if (obj.lift > 0.001) g.position.addScaledVector(inHand ? camUp : UP, obj.lift * this.handLift);
      if (obj.shakeUntil > now) g.position.add(this.tmp.set((Math.random() - 0.5) * 0.09, 0, (Math.random() - 0.5) * 0.09));
      obj.glow.visible = hl > 0;
      obj.glow.material = hl === 1 ? glowPulse : glowSolid;
    }
    glowPulse.opacity = pulse;

    const snap = this.snap,
      cfg = this.cfg;
    this.ghost.visible = !!snap && !!cfg && showGhost;
    if (this.ghost.visible && snap && cfg) {
      const t = ghostTransform(snap.players[snap.viewer_idx]?.body.length ?? 0, cfg);
      this.ghost.position.copy(t.pos);
      this.ghost.quaternion.copy(t.quat);
      this.ghost.scale.setScalar(t.s);
      (this.ghost.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.3 * pulse;
    }
    for (const z of this.zones) z.mesh.visible = targetPlayers.has(z.player);
    this.zoneMat.opacity = 0.1 + 0.14 * pulse;

    for (let i = this.pendingFlair.length - 1; i >= 0; i--) {
      const f = this.pendingFlair[i];
      if (now < f.at) continue;
      this.pendingFlair.splice(i, 1);
      this.playFlair(f.ev, f.pos, now);
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i],
        k = (now - f.t0) / f.life;
      if (k >= 1) {
        f.dispose();
        this.fx.splice(i, 1);
        continue;
      }
      f.step(k, dt);
    }
  }

  private playFlair(ev: FlairEvent, pos: THREE.Vector3 | undefined, now: number) {
    const col = FLAIR_COLOR[ev.kind];
    const organ = ev.organId ? this.objs.get(ev.organId) : undefined;
    const at = pos ?? organ?.cur.pos.clone();
    if (!at) {
      this.callout(new THREE.Vector3(0, 0.5, 0), FLAIR_WORD[ev.kind], col, now);
      return;
    }
    this.burst(at, col, now);
    this.callout(at, FLAIR_WORD[ev.kind], col, now);
    if (organ && ev.kind !== "destroy") organ.shakeUntil = now + 420;
  }

  private burst(pos: THREE.Vector3, color: string, now: number) {
    const n = 46,
      g = new THREE.BufferGeometry(),
      arr = new Float32Array(n * 3),
      vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      arr.set([pos.x, pos.y + 0.2, pos.z], i * 3);
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5 + 2, (Math.random() - 0.5) * 5));
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: lin(parseInt(color.slice(1), 16)), size: 0.16, transparent: true, depthWrite: false });
    const pts = new THREE.Points(g, mat);
    this.root.add(pts);
    this.fx.push({
      t0: now,
      life: 950,
      step: (k, dt) => {
        const a = g.attributes.position.array as Float32Array;
        for (let i = 0; i < n; i++) {
          vel[i].y -= 9 * dt;
          a[i * 3] += vel[i].x * dt;
          a[i * 3 + 1] = Math.max(0.02, a[i * 3 + 1] + vel[i].y * dt);
          a[i * 3 + 2] += vel[i].z * dt;
        }
        g.attributes.position.needsUpdate = true;
        mat.opacity = 1 - k;
      },
      dispose: () => {
        this.root.remove(pts);
        g.dispose();
        mat.dispose();
      },
    });
  }

  private callout(pos: THREE.Vector3, text: string, color: string, now: number) {
    const layer = this.calloutLayer;
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "ap3d-callout";
    el.textContent = text;
    el.style.color = color;
    layer.appendChild(el);
    const c = { el, anchor: pos.clone().setY(pos.y + 0.6) };
    this.callouts.push(c);
    this.fx.push({
      t0: now,
      life: 1300,
      step: () => {},
      dispose: () => {
        el.remove();
        this.callouts = this.callouts.filter((x) => x !== c);
      },
    });
  }

  /** places the HTML callouts over their world anchors */
  placeCallouts(cam: THREE.PerspectiveCamera) {
    for (const { el, anchor } of this.callouts) {
      const v = this.tmp.copy(anchor).project(cam);
      el.style.left = ((v.x + 1) / 2) * 100 + "%";
      el.style.top = ((1 - v.y) / 2) * 100 + "%";
    }
  }

  /** with a selection active, a glowing target under the pointer wins over hand cards in front of it */
  pick(ray: THREE.Raycaster): PickHit | null {
    const list: THREE.Object3D[] = [];
    for (const o of this.objs.values()) if (!o.leaveAt) list.push(o.front, o.back);
    if (this.ghost.visible) list.push(this.ghost);
    for (const z of this.zones) if (z.mesh.visible) list.push(z.mesh);
    const hits = ray.intersectObjects(list, false);
    const asHit = (o: THREE.Object3D): PickHit | null => {
      if (o === this.ghost) return { kind: "ghost" };
      if (o.userData.zone !== undefined) return { kind: "zone", player: o.userData.zone as number };
      if (o.userData.cardId) return { kind: "card", id: o.userData.cardId as string, front: !!o.userData.front };
      return null;
    };
    if (this.hl.selection.size)
      for (const h of hits) {
        const hit = asHit(h.object);
        if (!hit) continue;
        if (hit.kind !== "card") return hit;
        const loc = this.locs.get(hit.id);
        if (loc?.kind === "organ" && (this.hl.targetOrgans.has(loc.organId) || this.hl.pendingOrgan === loc.organId)) return hit;
      }
    for (const h of hits) {
      const hit = asHit(h.object);
      if (hit) return hit;
    }
    return null;
  }

  dispose() {
    this.clear();
    for (const z of this.zones) this.root.remove(z.mesh);
    this.zoneMat.dispose();
    (this.ghost.material as THREE.Material).dispose();
  }
}

function samePose(a: Target, b: Target) {
  return a.pos.distanceTo(b.pos) < 0.002 && a.quat.angleTo(b.quat) < 0.01 && Math.abs(a.s - b.s) < 0.002;
}
