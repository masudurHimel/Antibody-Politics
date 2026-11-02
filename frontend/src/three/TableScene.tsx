// The 3D table (React Three Fiber). A pure view of `snapshot`: it renders, animates and reports clicks; the shell
// decides what is legal and what glows. Look and behaviour are ported from reference/v2-mock/antibody-politics.html.
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Card, Snapshot } from "../game/types";
import type { TableSceneProps } from "./contract";
import { cardInfo, ensureCardFonts, rng } from "../cards/textures";
import { CardTable, lin } from "./CardTable";
import { diffFlair, diffHeroes } from "./diff";
import { fitCamera, sceneConfig, seatOf, tagAnchor } from "./layout";
import { OVERLAY_CSS } from "./overlayStyles";

const TINTS = {
  solo: ["#F2C14E", "#EF3E65", "#7FC23A", "#2E7BC4", "#8E5BC9", "#F39A3A"],
  mp: ["#2FB67C", "#E8475F", "#3E86D6", "#8E5BC9", "#F39A3A", "#F2C14E"],
};

const initials = (n: string) =>
  n
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

function findCard(snap: Snapshot, id: string): Pick<Card, "type" | "color" | "treatment_kind"> | null {
  for (const c of snap.players[snap.viewer_idx]?.hand ?? []) if (c.id === id) return c;
  if (snap.discard_top?.id === id) return snap.discard_top;
  for (const P of snap.players)
    for (const o of P.body) {
      if (o.id === id) return { type: "organ", color: o.color };
      for (const c of o.attached) if (c.id === id) return c;
    }
  return null;
}

interface Overlay {
  tags: MutableRefObject<Map<number, HTMLDivElement>>;
  timers: MutableRefObject<Map<number, HTMLElement>>;
  deadline: MutableRefObject<{ at: number; start: number } | null>;
  callouts: RefObject<HTMLDivElement>;
  tip: RefObject<HTMLDivElement>;
  props: MutableRefObject<TableSceneProps>;
}

export function TableScene(props: TableSceneProps) {
  const { snapshot: snap, mode } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const tags = useRef(new Map<number, HTMLDivElement>());
  const timers = useRef(new Map<number, HTMLElement>());
  const deadline = useRef<{ at: number; start: number } | null>(null);
  const callouts = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => ensureCardFonts(), []);
  if ((deadline.current?.at ?? null) !== props.turnDeadline)
    deadline.current = props.turnDeadline === null ? null : { at: props.turnDeadline, start: Date.now() };

  const overlay: Overlay = { tags, timers, deadline, callouts, tip, props: propsRef };
  const tints = TINTS[mode];

  return (
    <div className="ap3d-stage">
      <style>{OVERLAY_CSS}</style>
      <Canvas
        shadows="soft"
        flat
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 38, near: 0.1, far: 200, position: [0, 11, 9], manual: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <World />
        <Scene p={props} overlay={overlay} />
      </Canvas>
      <div className="ap3d-layer">
        {snap.players.map((P, p) => {
          if (p === snap.viewer_idx) return null;
          const healthy = P.body.filter((o) => o.status !== "infected").length;
          const active = snap.turn_idx === p && snap.winner_idx === null;
          const thinking = mode === "solo" && props.thinkingPlayer === p;
          return (
            <div
              key={p}
              className={"ap3d-seat" + (active ? " active" : "")}
              style={{ left: -9999, top: -9999 }}
              ref={(el) => {
                if (el) tags.current.set(p, el);
                else tags.current.delete(p);
              }}
            >
              <div className={"ap3d-bubble" + (thinking ? " on" : "")}>
                {thinking && (
                  <span className="ap3d-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              <div className="ap3d-plate">
                <span className="ap3d-av" style={{ background: tints[p % tints.length] }}>
                  {initials(P.name)}
                </span>
                <span className="who">
                  <b>{P.name}</b>
                  <small>
                    {P.hand_count} cards · {healthy}/4 healthy
                  </small>
                  {mode === "mp" && (
                    <span className="ap3d-tbar">
                      <i
                        ref={(el) => {
                          if (el) timers.current.set(p, el);
                          else timers.current.delete(p);
                        }}
                      />
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ap3d-layer" ref={callouts} />
      <div className="ap3d-tip" ref={tip} hidden />
    </div>
  );
}

/* ---------------- world: felt table, wooden rim, warm lamp ---------------- */

function feltTexture(a: string, b: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1024;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(512, 512, 60, 512, 512, 560);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 1024);
  const R = rng(42);
  for (let i = 0; i < 26000; i++) {
    c.fillStyle = `rgba(${R() > 0.5 ? "255,255,255" : "0,0,0"},${R() * 0.05})`;
    c.fillRect(R() * 1024, R() * 1024, 2, 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The mock used legacy (pre-r155) light units; physically based intensities are those values × π.
const PI = Math.PI;

function World() {
  const felt = useMemo(() => feltTexture("#2B7468", "#123C37"), []);
  const rim = useMemo(() => lin(0x4a2e22), []);
  useEffect(() => () => felt.dispose(), [felt]);
  return (
    <>
      <color attach="background" args={["#0B1719"]} />
      <mesh scale={[7.4, 1, 6.4]} position={[0, -0.15, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.3, 96]} />
        <meshStandardMaterial map={felt} roughness={0.95} />
      </mesh>
      <mesh scale={[7.8, 1, 6.8]} position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.36, 96]} />
        <meshStandardMaterial color={rim} roughness={0.6} />
      </mesh>
      <mesh rotation={[-PI / 2, 0, 0]} position={[0, -3, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#0B1719" />
      </mesh>
      {/* lamp wide enough to reach every seat, plus enough fill that the far side of the table is never in shadow */}
      <ambientLight color={lin(0xffe7c2)} intensity={0.5 * PI} />
      <spotLight
        color={lin(0xfff1d6)}
        intensity={1.25 * PI}
        distance={0}
        angle={1.05}
        penumbra={0.85}
        decay={0}
        position={[0, 16, 0]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={[lin(0xbfe3e6), lin(0x1a0f08), 0.55 * PI]} />
    </>
  );
}

/* ---------------- cards, picking and overlays ---------------- */

function Scene({ p, overlay }: { p: TableSceneProps; overlay: Overlay }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const n = p.snapshot.players.length;
  const cfg = useMemo(() => sceneConfig(p.mode, n), [p.mode, n]);
  const table = useMemo(() => new CardTable(), []);

  useEffect(() => {
    table.calloutLayer = overlay.callouts.current;
    return () => table.dispose();
  }, [table, overlay.callouts]);

  const last = useRef<{ snap: Snapshot | null; w: number; h: number; cfg: unknown; seq: number | null }>({
    snap: null,
    w: 0,
    h: 0,
    cfg: null,
    seq: null,
  });
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    const L = last.current;
    const refit = L.w !== size.width || L.h !== size.height || L.cfg !== cfg;
    if (refit) {
      const fit = fitCamera(cam, size.width, size.height, cfg);
      p.onLayout?.({ handTopFrac: fit.handTopFrac });
    }
    if (refit || !L.snap) table.sync(p.snapshot, cam, cfg, { instant: true, speed: p.animSpeed });
    else if (L.snap !== p.snapshot) {
      const action = p.lastAction && p.lastAction.seq !== L.seq ? p.lastAction : null;
      table.sync(p.snapshot, cam, cfg, {
        instant: false,
        heroes: diffHeroes(L.snap, p.snapshot, action),
        flair: diffFlair(L.snap, p.snapshot),
        speed: p.animSpeed,
      });
    }
    L.snap = p.snapshot;
    L.w = size.width;
    L.h = size.height;
    L.cfg = cfg;
    L.seq = p.lastAction?.seq ?? null;
    // onLayout / lastAction / animSpeed are read at sync time, not triggers
  }, [p.snapshot, size.width, size.height, cfg, cam, table]);

  useEffect(() => {
    table.hl = {
      selection: new Set(p.selection),
      targetOrgans: p.targetOrgans,
      pendingOrgan: p.pendingOrgan,
      targetPlayers: p.targetPlayers,
      showGhost: p.showGhostSlot,
      interactive: p.interactive,
    };
  }, [table, p.selection, p.targetOrgans, p.pendingOrgan, p.targetPlayers, p.showGhostSlot, p.interactive]);

  useEffect(() => {
    const el = gl.domElement,
      ray = new THREE.Raycaster(),
      ndc = new THREE.Vector2();
    const pickAt = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      return { hit: table.pick(ray), r };
    };
    const isTarget = (P: TableSceneProps, organId: string) => P.targetOrgans.has(organId) || P.pendingOrgan === organId;

    const move = (ev: PointerEvent) => {
      const P = overlay.props.current;
      const { hit, r } = pickAt(ev);
      const loc = hit?.kind === "card" ? table.locs.get(hit.id) : undefined;
      table.hoverId = hit?.kind === "card" && loc?.kind === "hand" ? hit.id : null;

      const tip = overlay.tip.current;
      const card = hit?.kind === "card" && hit.front && loc && !(loc.kind === "organ" && loc.faceDown) ? findCard(P.snapshot, hit.id) : null;
      if (tip) {
        if (card) {
          const info = cardInfo(card);
          tip.replaceChildren(Object.assign(document.createElement("b"), { textContent: info.name }), info.rule);
          tip.hidden = false;
          tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 240) + "px";
          tip.style.top = Math.max(ev.clientY - r.top - 70, 8) + "px";
        } else tip.hidden = true;
      }
      const clickable =
        !!hit && (hit.kind !== "card" || loc?.kind === "hand" || (loc?.kind === "organ" && isTarget(P, loc.organId)));
      el.style.cursor = clickable && P.interactive ? "pointer" : "default";
    };
    const leave = () => {
      if (overlay.tip.current) overlay.tip.current.hidden = true;
      table.hoverId = null;
    };
    const click = (ev: MouseEvent) => {
      const P = overlay.props.current;
      if (!P.interactive) return;
      const { hit } = pickAt(ev);
      if (!hit) return P.onBackgroundClick();
      if (hit.kind === "ghost") return P.onGhostClick();
      if (hit.kind === "zone") return P.onPlayerClick(hit.player);
      const loc = table.locs.get(hit.id);
      if (loc?.kind === "hand") return P.onHandCardClick(hit.id);
      if (loc?.kind === "organ") return P.onOrganClick({ player: loc.player, organ_id: loc.organId });
      P.onBackgroundClick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("click", click);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("click", click);
    };
  }, [gl, cam, table, overlay.props, overlay.tip]);

  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    table.frame(performance.now(), Math.min(0.05, dt), cam);
    table.placeCallouts(cam);

    const P = overlay.props.current,
      snap = P.snapshot,
      W = size.width,
      H = size.height;
    const dl = overlay.deadline.current;
    const left = dl && snap.winner_idx === null ? Math.max(0, Math.min(1, (dl.at - Date.now()) / Math.max(1, dl.at - dl.start))) : 0;
    for (const [player, el] of overlay.tags.current) {
      const a = tagAnchor(seatOf(player, snap.viewer_idx, snap.players.length), cfg, W);
      v.copy(a.pos).project(cam);
      const w = el.offsetWidth,
        x = ((v.x + 1) / 2) * W,
        y = ((1 - v.y) / 2) * H;
      el.classList.toggle("side-l", a.side < 0);
      el.classList.toggle("side-r", a.side > 0);
      el.style.left =
        (a.side < 0 ? Math.max(w + 6, x) : a.side > 0 ? Math.min(W - w - 6, x) : Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, x))) + "px";
      // top seats never touch the stage edge
      el.style.top = (a.side ? y : Math.max(el.offsetHeight + 10, y)) + "px";
      const bar = overlay.timers.current.get(player);
      if (bar) bar.style.width = (player === snap.turn_idx ? left * 100 : 0) + "%";
    }
  });

  return <primitive object={table.root} />;
}
