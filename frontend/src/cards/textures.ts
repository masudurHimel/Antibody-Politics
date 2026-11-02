// Card art drawn in code onto a 360×504 canvas design space (ported 1:1 from the approved v2 mock),
// plus cached THREE.CanvasTextures for the 3D table. Nothing here touches the DOM at import time.
import * as THREE from "three";
import type { Card, Color, TreatmentKind } from "../game/types";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const INK = "#1B1414";

export const CARD_W = 360;
export const CARD_H = 504;

interface Palette {
  base: string;
  ink: string;
  light: string;
  name: string;
}

const COLORS: Record<Color | "purple", Palette> = {
  red: { base: "#EF3E65", ink: "#B03140", light: "#FF9DB1", name: "Red" },
  green: { base: "#7FC23A", ink: "#46984A", light: "#D2F59A", name: "Green" },
  blue: { base: "#2E7BC4", ink: "#253E5A", light: "#8FCBFF", name: "Blue" },
  yellow: { base: "#F39A3A", ink: "#D9781A", light: "#FFE08E", name: "Yellow" },
  multi: { base: "#9B59B6", ink: "#3B2A4A", light: "#FFFFFF", name: "Multicolor" },
  purple: { base: "#7A2E8E", ink: "#5A1E6C", light: "#E7C8F2", name: "Treatment" },
};
const ORGAN_NAME: Record<Color, string> = {
  red: "Heart",
  green: "Stomach",
  blue: "Brain",
  yellow: "Bone",
  multi: "Wild organ",
};

/** the mock's short treatment keys */
export type TreatKey = "contagion" | "thief" | "transplant" | "latex" | "error";
const TREAT_TINT: Record<TreatKey, string> = {
  contagion: "#FFB08A",
  thief: "#FFD08A",
  transplant: "#A9BEFF",
  latex: "#C9F5DD",
  error: "#EDF7A0",
};
const TREAT_KEY: Record<TreatmentKind, TreatKey> = {
  transplant: "transplant",
  organ_thief: "thief",
  contagion: "contagion",
  latex_glove: "latex",
  medical_error: "error",
};

export type CardKind = "organ" | "virus" | "medicine" | "treatment";

export interface CardTypeInfo {
  key: string;
  kind: CardKind;
  color: Color | "purple";
  name: string;
  rule: string;
  t?: TreatKey;
}

const TYPES: CardTypeInfo[] = [];
const addT = (key: string, kind: CardKind, color: Color | "purple", name: string, rule: string, t?: TreatKey) =>
  TYPES.push({ key, kind, color, name, rule, t });
const BASIC: Color[] = ["red", "green", "blue", "yellow"];
for (const c of BASIC) addT("organ-" + c, "organ", c, ORGAN_NAME[c], "Builds your body. Four healthy organs of different colours wins.");
addT("organ-multi", "organ", "multi", "Wild organ", "Counts as any colour. Any virus can hit it and any medicine can help it.");
for (const c of BASIC)
  addT(
    "virus-" + c,
    "virus",
    c,
    COLORS[c].name + " virus",
    `Infects a free ${ORGAN_NAME[c]}. A second one destroys it. It also breaks a ${COLORS[c].name.toLowerCase()} vaccine.`,
  );
addT("virus-multi", "virus", "multi", "Multicolor virus", "Hits an organ or medicine of any colour. Any medicine cures it.");
for (const c of BASIC)
  addT(
    "medicine-" + c,
    "medicine",
    c,
    COLORS[c].name + " medicine",
    `Cures a ${COLORS[c].name.toLowerCase()} virus or vaccinates a free organ. A second medicine immunizes it.`,
  );
addT("medicine-multi", "medicine", "multi", "Multicolor medicine", "Works on any colour, but a virus of any colour can break it.");
addT("treatment-contagion", "treatment", "purple", "Contagion", "Moves your viruses onto other players' free organs.", "contagion");
addT("treatment-thief", "treatment", "purple", "Organ Thief", "Steals an organ that isn't immunized.", "thief");
addT("treatment-transplant", "treatment", "purple", "Transplant", "Swaps one of your organs with another player's.", "transplant");
addT("treatment-latex", "treatment", "purple", "Latex Glove", "Every other player drops their hand and misses a turn.", "latex");
addT("treatment-error", "treatment", "purple", "Medical Error", "Swaps your whole body with another player's.", "error");

export const CARD_TYPES: ReadonlyMap<string, CardTypeInfo> = new Map(TYPES.map((t) => [t.key, t]));

/** snapshot card → the mock's type key, e.g. `virus-blue`, `treatment-thief` */
export function cardKey(card: Pick<Card, "type" | "color" | "treatment_kind">): string {
  if (card.type === "treatment") return "treatment-" + TREAT_KEY[card.treatment_kind ?? "contagion"];
  return `${card.type}-${card.color}`;
}

export function cardInfo(card: Pick<Card, "type" | "color" | "treatment_kind">): CardTypeInfo {
  return CARD_TYPES.get(cardKey(card))!;
}

/* ---------------- drawing helpers ---------------- */
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function circ(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}
function ink(c: Ctx, lw = 9) {
  c.lineWidth = lw;
  c.strokeStyle = INK;
  c.lineJoin = "round";
  c.lineCap = "round";
}
function fs(c: Ctx, fill: string, lw = 9) {
  c.fillStyle = fill;
  c.fill();
  ink(c, lw);
  c.stroke();
}
function union(c: Ctx, shapes: (() => void)[], fill: string, lw = 18) {
  ink(c, lw);
  for (const f of shapes) {
    f();
    c.stroke();
  }
  c.fillStyle = fill;
  for (const f of shapes) {
    f();
    c.fill();
  }
}
function shine(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fillStyle = "rgba(255,255,255,.55)";
  c.fill();
}
export function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function heartPath(c: Ctx, s = 1) {
  c.beginPath();
  c.moveTo(0, 100 * s);
  c.bezierCurveTo(-70 * s, 60 * s, -118 * s, 8 * s, -100 * s, -42 * s);
  c.bezierCurveTo(-86 * s, -88 * s, -28 * s, -96 * s, 0, -58 * s);
  c.bezierCurveTo(28 * s, -96 * s, 86 * s, -88 * s, 100 * s, -42 * s);
  c.bezierCurveTo(118 * s, 8 * s, 70 * s, 60 * s, 0, 100 * s);
  c.closePath();
}

interface GermOpts {
  col: string;
  r?: number;
  spikes?: number;
  spikeLen?: number;
  wob?: number;
  wobN?: number;
  ry?: number;
  mouth?: "grin" | "scream";
}

function germ(c: Ctx, o: GermOpts) {
  const { col, r = 80, spikes = 0, spikeLen = 40, wob = 0, wobN = 6, ry = 1, mouth = "grin" } = o;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU + 0.2,
      x1 = Math.cos(a) * r * 0.8,
      y1 = Math.sin(a) * r * ry * 0.8;
    const x2 = Math.cos(a) * (r + spikeLen),
      y2 = Math.sin(a) * (r * ry + spikeLen);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    ink(c, 16);
    c.stroke();
    c.strokeStyle = col;
    c.lineWidth = 7;
    c.stroke();
    circ(c, x2, y2, 10);
    fs(c, col, 7);
  }
  c.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * TAU,
      k = r * (1 + wob * Math.sin(a * wobN));
    const x = Math.cos(a) * k,
      y = Math.sin(a) * k * ry;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.closePath();
  fs(c, col);
  shine(c, -r * 0.42, -r * ry * 0.55, r * 0.2, r * 0.1, -0.6);
  const k = r / 80;
  c.save();
  c.scale(k, k);
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.ellipse(sx * 27, -22, 15, 18, 0, 0, TAU);
    fs(c, "#fff", 6);
    circ(c, sx * 24, -18, 7);
    c.fillStyle = INK;
    c.fill();
    c.beginPath();
    c.moveTo(sx * 44, -48);
    c.lineTo(sx * 12, -38);
    ink(c, 7);
    c.stroke();
  }
  if (mouth === "grin") {
    c.beginPath();
    c.moveTo(-50, 8);
    c.quadraticCurveTo(0, 74, 50, 8);
    c.closePath();
    fs(c, "#4A0E18", 7);
    for (let x = -42; x < 40; x += 16) {
      c.beginPath();
      c.moveTo(x, 10);
      c.lineTo(x + 8, 25);
      c.lineTo(x + 16, 10);
      c.closePath();
      c.fillStyle = "#fff";
      c.fill();
      ink(c, 3);
      c.stroke();
    }
  } else {
    c.beginPath();
    c.ellipse(0, 30, 28, 40, 0, 0, TAU);
    fs(c, "#4A0E18", 7);
    for (let x = -18; x < 18; x += 12) {
      c.beginPath();
      c.moveTo(x, -6);
      c.lineTo(x + 6, 8);
      c.lineTo(x + 12, -6);
      c.fillStyle = "#fff";
      c.fill();
    }
  }
  c.restore();
}

function capsule(c: Ctx, x: number, y: number, a: number, L: number, w: number, c1: string, c2: string) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  const path = () => rr(c, -L / 2, -w / 2, L, w, w / 2);
  path();
  c.fillStyle = c2;
  c.fill();
  c.save();
  path();
  c.clip();
  c.fillStyle = c1;
  c.fillRect(-L / 2, -w / 2, L / 2, w);
  c.restore();
  c.beginPath();
  c.moveTo(0, -w / 2);
  c.lineTo(0, w / 2);
  ink(c, 6);
  c.stroke();
  path();
  ink(c);
  c.stroke();
  shine(c, -L / 4, -w / 5, L / 9, w / 10);
  c.restore();
}

function arrowArc(c: Ctx, r: number, a0: number, a1: number, col: string) {
  c.beginPath();
  c.arc(0, 0, r, a0, a1);
  ink(c, 20);
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = 9;
  c.stroke();
  const x = Math.cos(a1) * r,
    y = Math.sin(a1) * r,
    t = a1 + Math.PI / 2;
  c.save();
  c.translate(x, y);
  c.rotate(t);
  c.beginPath();
  c.moveTo(16, 0);
  c.lineTo(-12, -16);
  c.lineTo(-12, 16);
  c.closePath();
  fs(c, col, 6);
  c.restore();
}

export const ILLUS: Record<string, (c: Ctx) => void> = {
  "organ-red"(c) {
    union(c, [() => rr(c, -38, -122, 28, 74, 14), () => rr(c, 0, -112, 24, 64, 12), () => rr(c, 30, -98, 20, 48, 10)], "#C7334C");
    heartPath(c);
    fs(c, "#F2506C");
    c.beginPath();
    c.moveTo(-12, -40);
    c.quadraticCurveTo(12, 0, -6, 44);
    ink(c, 5);
    c.strokeStyle = "#A32740";
    c.stroke();
    shine(c, -54, -42, 20, 11, -0.6);
  },
  "organ-green"(c) {
    c.beginPath();
    c.moveTo(-28, 74);
    c.quadraticCurveTo(-52, 96, -74, 112);
    ink(c, 40);
    c.stroke();
    c.strokeStyle = "#8CC94A";
    c.lineWidth = 22;
    c.stroke();
    c.beginPath();
    c.moveTo(-34, -124);
    c.quadraticCurveTo(-42, -88, -26, -60);
    ink(c, 40);
    c.stroke();
    c.strokeStyle = "#8CC94A";
    c.lineWidth = 22;
    c.stroke();
    c.beginPath();
    c.moveTo(-30, -66);
    c.bezierCurveTo(-98, -46, -104, 62, -26, 86);
    c.bezierCurveTo(40, 108, 108, 66, 94, 6);
    c.bezierCurveTo(84, -36, 44, -28, 34, -54);
    c.bezierCurveTo(24, -84, -8, -84, -30, -66);
    c.closePath();
    fs(c, "#B6EA6C");
    c.beginPath();
    c.moveTo(-62, 18);
    c.quadraticCurveTo(-20, 72, 52, 40);
    ink(c, 5);
    c.strokeStyle = "#5E9A2E";
    c.stroke();
    shine(c, -50, -24, 16, 9, -1);
  },
  "organ-blue"(c) {
    union(c, [() => rr(c, 8, 40, 34, 64, 14)], "#7FAEDD");
    const path = () => {
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU,
          k = 1 + 0.05 * Math.sin(a * 11);
        const x = Math.cos(a) * 110 * k,
          y = -8 + Math.sin(a) * 80 * k;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
    };
    path();
    fs(c, "#AFD5F7");
    c.save();
    path();
    c.clip();
    ink(c, 5);
    c.strokeStyle = "#3B6A96";
    const folds = [
      [-92, -44, 70],
      [-100, -6, 84],
      [-80, 34, 66],
      [6, -60, 84],
      [-34, -24, 110],
      [-12, 14, 104],
      [-56, -66, 50],
      [20, 48, 70],
    ];
    for (const [x, y, len] of folds) {
      c.beginPath();
      for (let t = 0; t <= len; t += 4) {
        const yy = y + Math.sin(t * 0.17 + x) * 8;
        if (t) c.lineTo(x + t, yy);
        else c.moveTo(x + t, yy);
      }
      c.stroke();
    }
    c.restore();
    path();
    ink(c);
    c.stroke();
    shine(c, -60, -52, 18, 9, -0.4);
  },
  "organ-yellow"(c) {
    c.rotate(-0.85);
    union(
      c,
      [
        () => rr(c, -96, -17, 192, 34, 14),
        () => circ(c, -106, -19, 27),
        () => circ(c, -106, 19, 27),
        () => circ(c, 106, -19, 27),
        () => circ(c, 106, 19, 27),
      ],
      "#FFF1D6",
    );
    shine(c, -40, -6, 40, 5);
    c.beginPath();
    c.moveTo(-60, 8);
    c.lineTo(50, 8);
    ink(c, 4);
    c.strokeStyle = "#D8C29A";
    c.stroke();
  },
  "organ-multi"(c) {
    union(
      c,
      [
        () => circ(c, 0, -92, 34),
        () => rr(c, -44, -58, 88, 104, 30),
        () => rr(c, -72, -50, 26, 86, 13),
        () => rr(c, 46, -50, 26, 86, 13),
        () => rr(c, -38, 34, 30, 92, 14),
        () => rr(c, 8, 34, 30, 92, 14),
      ],
      "#B793E0",
    );
    c.save();
    c.scale(0.22, 0.22);
    c.translate(-40, -40);
    heartPath(c);
    fs(c, "#F2506C", 24);
    c.restore();
    c.beginPath();
    c.ellipse(0, -96, 22, 14, 0, 0, TAU);
    fs(c, "#AFD5F7", 6);
    c.beginPath();
    c.ellipse(14, 12, 18, 13, 0.4, 0, TAU);
    fs(c, "#B6EA6C", 6);
    c.save();
    c.translate(-6, 40);
    c.rotate(-0.3);
    rr(c, -22, -6, 44, 12, 6);
    fs(c, "#FFF1D6", 5);
    c.restore();
  },
  "virus-red"(c) {
    germ(c, { col: "#E8475F", r: 80, wob: 0.05, wobN: 3 });
  },
  "virus-green"(c) {
    for (const [sx, sy, a] of [
      [-70, 60, 1],
      [70, 64, -1],
    ]) {
      c.beginPath();
      c.moveTo(sx * 0.5, sy * 0.6);
      c.bezierCurveTo(sx * 1.2, sy * 1.1, sx * 1.8 * a * a, sy * 0.2, sx * 1.35, sy * 1.6);
      ink(c, 26);
      c.stroke();
      c.strokeStyle = "#8BCB45";
      c.lineWidth = 12;
      c.stroke();
    }
    germ(c, { col: "#8BCB45", r: 74, wob: 0.12, wobN: 5 });
  },
  "virus-blue"(c) {
    germ(c, { col: "#5C9EE0", r: 62, spikes: 18, spikeLen: 60 });
  },
  "virus-yellow"(c) {
    germ(c, { col: "#F3A83A", r: 70, ry: 1.32, wob: 0.07, wobN: 9, mouth: "scream" });
  },
  "virus-multi"(c) {
    germ(c, { col: "#8E5BC9", r: 74, spikes: 10, spikeLen: 38 });
  },
  "medicine-red"(c) {
    c.rotate(-0.8);
    c.beginPath();
    c.moveTo(70, 0);
    c.lineTo(134, 0);
    ink(c, 13);
    c.stroke();
    c.strokeStyle = "#DADADA";
    c.lineWidth = 5;
    c.stroke();
    rr(c, -134, -8, 66, 16, 4);
    fs(c, "#EFE7E7", 7);
    rr(c, -148, -32, 16, 64, 6);
    fs(c, "#B03140", 7);
    rr(c, 56, -13, 20, 26, 5);
    fs(c, "#C9C9C9", 7);
    rr(c, -74, -30, 136, 60, 12);
    c.fillStyle = "#FBEFF1";
    c.fill();
    c.save();
    rr(c, -74, -30, 136, 60, 12);
    c.clip();
    c.fillStyle = "#E8475F";
    c.fillRect(-14, -30, 80, 60);
    c.restore();
    rr(c, -74, -30, 136, 60, 12);
    ink(c);
    c.stroke();
    for (let x = -58; x < 56; x += 18) {
      c.beginPath();
      c.moveTo(x, -30);
      c.lineTo(x, -16);
      ink(c, 3);
      c.stroke();
    }
    rr(c, -86, -48, 13, 96, 5);
    fs(c, "#FBEFF1", 7);
    shine(c, -40, -14, 22, 5);
  },
  "medicine-green"(c) {
    rr(c, -64, -44, 128, 144, 26);
    fs(c, "#8CD04F");
    rr(c, -30, -76, 60, 36, 8);
    fs(c, "#8CD04F");
    rr(c, -40, -114, 80, 40, 10);
    fs(c, "#2F6B2F");
    rr(c, -48, -4, 96, 66, 8);
    fs(c, "#EEF8DF", 6);
    ink(c, 4);
    c.strokeStyle = "#6E9A4E";
    for (const y of [12, 26, 40]) {
      c.beginPath();
      c.moveTo(-32, y);
      c.lineTo(32, y);
      c.stroke();
    }
    shine(c, -42, -20, 8, 26);
  },
  "medicine-blue"(c) {
    capsule(c, -24, -46, -0.5, 176, 64, "#3E86D6", "#EEF6FF");
    capsule(c, 6, 46, -0.25, 156, 58, "#3E86D6", "#EEF6FF");
    circ(c, 90, -6, 30);
    fs(c, "#DDEBFA");
    c.beginPath();
    c.moveTo(68, -6);
    c.lineTo(112, -6);
    ink(c, 5);
    c.stroke();
  },
  "medicine-yellow"(c) {
    for (const a of [0.75, -0.75]) {
      c.save();
      c.rotate(a);
      rr(c, -124, -34, 248, 68, 30);
      fs(c, "#F5B467");
      rr(c, -36, -28, 72, 56, 10);
      fs(c, "#FCDDB0", 6);
      c.fillStyle = "#C98A40";
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          circ(c, i * 18, j * 14, 3.5);
          c.fill();
        }
      c.restore();
    }
  },
  "medicine-multi"(c) {
    c.beginPath();
    c.moveTo(-42, -46);
    c.lineTo(-42, -80);
    c.quadraticCurveTo(-42, -96, -26, -96);
    c.lineTo(26, -96);
    c.quadraticCurveTo(42, -96, 42, -80);
    c.lineTo(42, -46);
    ink(c, 30);
    c.stroke();
    c.strokeStyle = "#8E2233";
    c.lineWidth = 13;
    c.stroke();
    rr(c, -112, -56, 224, 142, 22);
    fs(c, "#E8475F");
    c.beginPath();
    c.moveTo(-112, -18);
    c.lineTo(112, -18);
    ink(c, 6);
    c.stroke();
    union(c, [() => rr(c, -16, -6, 32, 84, 6), () => rr(c, -42, 20, 84, 32, 6)], "#FFFFFF", 12);
    rr(c, 70, 40, 46, 60, 10);
    fs(c, "#8CD04F", 7);
    rr(c, 78, 24, 30, 18, 4);
    fs(c, "#2F6B2F", 6);
    shine(c, -80, -38, 18, 6);
  },
  "treatment-contagion"(c) {
    c.save();
    c.setLineDash([3, 16]);
    ink(c, 9);
    for (const [x, y] of [
      [-88, 72],
      [0, 100],
      [88, 72],
    ]) {
      c.beginPath();
      c.moveTo(0, -30);
      c.quadraticCurveTo(x * 0.3, 20, x * 0.8, y - 34);
      c.stroke();
    }
    c.restore();
    for (const [x, y] of [
      [-88, 72],
      [0, 100],
      [88, 72],
    ]) {
      c.beginPath();
      c.arc(x, y + 44, 32, Math.PI, 0);
      fs(c, "#7DA7C8", 7);
      circ(c, x, y, 24);
      fs(c, "#F6E1CC", 7);
      circ(c, x - 8, y - 2, 3);
      c.fillStyle = INK;
      c.fill();
      circ(c, x + 8, y - 2, 3);
      c.fill();
    }
    c.save();
    c.translate(0, -70);
    germ(c, { col: "#8BCB45", r: 42, spikes: 9, spikeLen: 22 });
    c.restore();
  },
  "treatment-thief"(c) {
    c.beginPath();
    c.moveTo(80, 40);
    c.quadraticCurveTo(120, 80, 96, 120);
    c.lineTo(66, 116);
    c.quadraticCurveTo(80, 84, 52, 60);
    c.closePath();
    fs(c, "#C9A27A");
    c.save();
    c.translate(-8, 16);
    c.scale(0.92, 0.92);
    heartPath(c);
    fs(c, "#F2506C", 10);
    c.restore();
    rr(c, -104, -48, 200, 46, 23);
    fs(c, "#1E1E26", 6);
    c.beginPath();
    c.moveTo(94, -30);
    c.lineTo(128, -54);
    c.lineTo(122, -18);
    c.closePath();
    fs(c, "#1E1E26", 6);
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(sx * 40 - 4, -25, 21, 12, 0, 0, TAU);
      c.fillStyle = "#fff";
      c.fill();
      circ(c, sx * 40 + 2, -24, 6);
      c.fillStyle = INK;
      c.fill();
    }
    shine(c, -60, 20, 16, 9, -0.6);
  },
  "treatment-transplant"(c) {
    arrowArc(c, 112, Math.PI * 1.12, Math.PI * 1.88, "#FFFFFF");
    arrowArc(c, 112, Math.PI * 0.12, Math.PI * 0.88, "#FFFFFF");
    c.save();
    c.translate(-52, 6);
    c.scale(0.46, 0.46);
    ILLUS["organ-red"](c);
    c.restore();
    c.save();
    c.translate(56, 6);
    c.scale(0.46, 0.46);
    ILLUS["organ-blue"](c);
    c.restore();
  },
  "treatment-latex"(c) {
    c.rotate(-0.12);
    const fingers = [-60, -28, 4, 36].map((x, i) => () => rr(c, x, -116 + (i === 0 || i === 3 ? 18 : 0), 28, 110, 14));
    const thumb = () => {
      c.save();
      c.translate(70, 6);
      c.rotate(-0.7);
      rr(c, -14, -64, 28, 82, 14);
      c.restore();
    };
    union(c, [...fingers, thumb, () => rr(c, -64, -30, 132, 126, 40)], "#D2F6E3");
    rr(c, -72, 88, 148, 40, 12);
    fs(c, "#9BD9BD");
    ink(c, 6);
    for (const [x1, y1, x2, y2] of [
      [-100, 100, -126, 110],
      [-100, 120, -128, 136],
      [104, 100, 130, 108],
    ]) {
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
    shine(c, -30, 10, 14, 30, 0.2);
  },
  "treatment-error"(c) {
    rr(c, -88, -110, 176, 222, 16);
    fs(c, "#C9A27A");
    rr(c, -72, -84, 144, 180, 8);
    fs(c, "#FFFDF5", 6);
    rr(c, -38, -126, 76, 36, 10);
    fs(c, "#9AA5AE", 7);
    ink(c, 4);
    c.strokeStyle = "#B9C2C7";
    for (const y of [-56, -40, -24]) {
      c.beginPath();
      c.moveTo(-52, y);
      c.lineTo(52, y);
      c.stroke();
    }
    c.font = '400 104px "Bowlby One", "Arial Black", sans-serif';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 10;
    c.strokeStyle = INK;
    c.strokeText("?!", 4, 44);
    c.fillStyle = "#E8475F";
    c.fillText("?!", 4, 44);
  },
};

export function pip(c: Ctx, T: CardTypeInfo, x: number, y: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = "#fff";
  c.strokeStyle = "rgba(0,0,0,.35)";
  c.lineWidth = 3;
  if (T.kind === "organ") {
    heartPath(c, 0.16);
    c.fill();
    c.stroke();
  } else if (T.kind === "virus") {
    c.strokeStyle = "#fff";
    c.lineWidth = 4;
    c.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      c.stroke();
      circ(c, Math.cos(a) * 18, Math.sin(a) * 18, 3.5);
      c.fill();
    }
    circ(c, 0, 0, 10);
    c.fill();
  } else if (T.kind === "medicine") {
    c.rotate(-0.75);
    rr(c, -19, -9, 38, 18, 9);
    c.fill();
    c.stroke();
  } else {
    rr(c, -6, -18, 12, 36, 3);
    c.fill();
    rr(c, -18, -6, 36, 12, 3);
    c.fill();
  }
  c.restore();
}

export function effectIcon(c: Ctx, T: CardTypeInfo, x: number, y: number) {
  c.save();
  c.translate(x, y);
  circ(c, 0, 0, 30);
  fs(c, "#fff", 5);
  c.fillStyle = INK;
  c.strokeStyle = INK;
  c.lineCap = "round";
  if (T.t === "contagion") {
    circ(c, 0, -3, 8);
    c.fill();
    for (const [dx, dy] of [
      [-15, 12],
      [0, 16],
      [15, 12],
    ]) {
      circ(c, dx, dy, 4);
      c.fill();
    }
  } else if (T.t === "thief") {
    c.save();
    c.scale(0.13, 0.13);
    heartPath(c);
    c.restore();
    c.fill();
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(4, 2);
    c.lineTo(20, -14);
    c.stroke();
  } else if (T.t === "transplant") {
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, 0, 15, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 15, Math.PI * 0.1, Math.PI * 0.9);
    c.stroke();
  } else if (T.t === "latex") {
    rr(c, -12, -4, 24, 20, 6);
    c.fill();
    for (let i = 0; i < 4; i++) {
      rr(c, -12 + i * 6.5, -18, 5, 16, 2.5);
      c.fill();
    }
  } else {
    c.font = '400 30px "Bowlby One", "Arial Black", sans-serif';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("?", 0, 2);
  }
  c.restore();
}

export function wobbleRect(c: Ctx, x: number, y: number, w: number, h: number, R: () => number) {
  const pts: [number, number][] = [],
    step = 22,
    j = () => (R() - 0.5) * 5;
  for (let t = 0; t < w; t += step) pts.push([x + t, y + j()]);
  for (let t = 0; t < h; t += step) pts.push([x + w + j(), y + t]);
  for (let t = 0; t < w; t += step) pts.push([x + w - t, y + h + j()]);
  for (let t = 0; t < h; t += step) pts.push([x + j(), y + h - t]);
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
}

function sunburst(c: Ctx, alpha: number) {
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < 40; i += 2) {
    const a0 = (i / 40) * TAU,
      a1 = ((i + 0.55) / 40) * TAU;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a0) * 700, Math.sin(a0) * 700);
    c.lineTo(Math.cos(a1) * 700, Math.sin(a1) * 700);
    c.closePath();
    c.fill();
  }
}

/** draws one card face in the 360×504 design space */
export function drawCard(c: Ctx, T: CardTypeInfo) {
  const W = CARD_W,
    H = CARD_H,
    pal = T.kind === "treatment" ? COLORS.purple : COLORS[T.color];
  const cx = W / 2,
    cy = H * 0.44;
  c.save();
  rr(c, 0, 0, W, H, 30);
  c.clip();
  c.fillStyle = pal.ink;
  c.fillRect(0, 0, W, H);
  c.save();
  rr(c, 16, 16, W - 32, H - 32, 18);
  c.clip();
  if (T.color === "multi") {
    const rainbow = ["#EF3E65", "#F39A3A", "#F7D84A", "#7FC23A", "#2E7BC4", "#8E44AD", "#EF3E65"];
    const g =
      typeof c.createConicGradient === "function"
        ? c.createConicGradient(-Math.PI / 2, cx, cy)
        : c.createLinearGradient(0, 0, W, H);
    rainbow.forEach((col, i) => g.addColorStop(i / (rainbow.length - 1), col));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const w = c.createRadialGradient(cx, cy, 0, cx, cy, 200);
    w.addColorStop(0, "rgba(255,255,255,.75)");
    w.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = w;
    c.fillRect(0, 0, W, H);
  } else {
    const inner = T.kind === "treatment" ? TREAT_TINT[T.t!] : pal.light;
    const g = c.createRadialGradient(cx, cy, 8, cx, cy, H * 0.64);
    g.addColorStop(0, inner);
    g.addColorStop(0.48, T.kind === "treatment" ? inner : pal.base);
    g.addColorStop(1, pal.ink);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  c.save();
  c.translate(cx, cy);
  sunburst(c, 0.17);
  c.restore();
  c.restore();
  wobbleRect(c, 30, 30, W - 60, H - 60, rng(hash(T.key)));
  c.lineWidth = 6;
  c.strokeStyle = "rgba(255,255,255,.95)";
  c.lineJoin = "round";
  c.stroke();
  c.save();
  c.translate(cx, H * 0.5);
  ILLUS[T.key](c);
  c.restore();
  pip(c, T, 46, 50, 0);
  if (T.kind === "treatment") effectIcon(c, T, W - 62, H - 66);
  else pip(c, T, W - 46, H - 50, Math.PI);
  c.restore();
  rr(c, 1.5, 1.5, W - 3, H - 3, 29);
  c.lineWidth = 3;
  c.strokeStyle = "#0B0B0B";
  c.stroke();
}

/** draws the shared card back in the 360×504 design space */
export function drawBack(c: Ctx) {
  const W = CARD_W,
    H = CARD_H,
    cx = W / 2,
    cy = H / 2;
  c.save();
  rr(c, 0, 0, W, H, 30);
  c.clip();
  c.fillStyle = "#0F1E24";
  c.fillRect(0, 0, W, H);
  c.save();
  rr(c, 16, 16, W - 32, H - 32, 18);
  c.clip();
  const g = c.createRadialGradient(cx, cy, 10, cx, cy, 320);
  g.addColorStop(0, "#2F6470");
  g.addColorStop(1, "#122830");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(cx, cy);
  sunburst(c, 0.07);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,.1)";
  c.lineWidth = 3;
  for (let y = 40; y < H; y += 64)
    for (let x = ((y / 64) % 2) * 32 + 30; x < W; x += 64) {
      circ(c, x, y, 8);
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
        c.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
        c.stroke();
      }
    }
  c.restore();
  wobbleRect(c, 30, 30, W - 60, H - 60, rng(7));
  c.lineWidth = 6;
  c.strokeStyle = "rgba(255,255,255,.9)";
  c.stroke();
  circ(c, cx, cy, 84);
  fs(c, "#F2C14E", 8);
  c.save();
  c.translate(cx, cy + 4);
  germ(c, { col: "#EF3E65", r: 40, spikes: 8, spikeLen: 18 });
  c.restore();
  c.font = '400 38px "Bowlby One", "Arial Black", sans-serif';
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const [t, y] of [
    ["ANTIBODY", cy - 140],
    ["POLITICS", cy + 140],
  ] as const) {
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.strokeText(t, cx, y);
    c.fillStyle = "#fff";
    c.fillText(t, cx, y);
  }
  c.restore();
  rr(c, 1.5, 1.5, W - 3, H - 3, 29);
  c.lineWidth = 3;
  c.strokeStyle = "#0B0B0B";
  c.stroke();
}

/** draws a face (type key) or the back (null) onto `cv`, sized to `w` pixels wide */
export function paintCardCanvas(cv: HTMLCanvasElement, key: string | null, w = 512): HTMLCanvasElement {
  cv.width = w;
  cv.height = Math.round((w * CARD_H) / CARD_W);
  const c = cv.getContext("2d")!;
  c.setTransform(w / CARD_W, 0, 0, cv.height / CARD_H, 0, 0);
  if (key) drawCard(c, CARD_TYPES.get(key)!);
  else drawBack(c);
  return cv;
}

/* ---------------- cached textures ---------------- */
const TEX_W = 512;
const texCache = new Map<string, THREE.CanvasTexture>();
const BACK = "__back__";

function makeTexture(key: string | null): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(paintCardCanvas(document.createElement("canvas"), key, TEX_W));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; // three clamps to the GPU maximum
  return tex;
}

/** one cached texture per card type, keyed by the mock's type key */
export function getTextureForKey(key: string): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) texCache.set(key, (t = makeTexture(key)));
  return t;
}

export function getCardTexture(card: Pick<Card, "type" | "color" | "treatment_kind">): THREE.CanvasTexture {
  return getTextureForKey(cardKey(card));
}

export function getBackTexture(): THREE.CanvasTexture {
  let t = texCache.get(BACK);
  if (!t) texCache.set(BACK, (t = makeTexture(null)));
  return t;
}

let fontsRequested = false;
/** Loads the display face the art uses ("Bowlby One"), then repaints any texture drawn before it arrived. */
export function ensureCardFonts(): void {
  if (fontsRequested || typeof document === "undefined") return;
  fontsRequested = true;
  const href =
    "https://fonts.googleapis.com/css2?family=Bowlby+One&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;600&display=swap";
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  if (!document.fonts?.load) return;
  document.fonts
    .load('40px "Bowlby One"')
    .then(() => {
      for (const [key, tex] of texCache) {
        paintCardCanvas(tex.image as HTMLCanvasElement, key === BACK ? null : key, TEX_W);
        tex.needsUpdate = true;
      }
    })
    .catch(() => {});
}
