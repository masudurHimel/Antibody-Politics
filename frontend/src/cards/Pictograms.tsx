import type { Card, Color, TreatmentKind } from "../game/types";

const INK = "#1a120c";
const PAPER = "#f3ead7";

const colorHex: Record<Color, string> = {
  red: "var(--c-red)",
  green: "var(--c-green)",
  blue: "var(--c-blue)",
  yellow: "var(--c-yellow)",
  multi: "url(#multi-grad)",
};
const colorDark: Record<Color, string> = {
  red: "var(--c-red-d)",
  green: "var(--c-green-d)",
  blue: "var(--c-blue-d)",
  yellow: "var(--c-yellow-d)",
  multi: "var(--c-red-d)",
};

/* =========================================================================
   ORGANS — hand-drawn cartoon style with bold ink outline, matching the
   reference card designs in sources/card_design/.
   All glyphs draw on a 100×100 viewBox centered ~ (50,50).
   ========================================================================= */

function HeartOrgan() {
  // Red heart with stem/aorta at top, bold outline, soft highlight.
  const fill = colorHex.red;
  const dark = colorDark.red;
  return (
    <g>
      {/* aorta stem */}
      <path
        d="M46 20 C 44 14, 52 10, 54 16 L 54 28"
        fill={dark}
        stroke={INK}
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* heart body */}
      <path
        d="M50 86
           C 16 64, 8 42, 22 28
           C 32 18, 44 22, 50 32
           C 56 22, 68 18, 78 28
           C 92 42, 84 64, 50 86 Z"
        fill={fill}
        stroke={INK}
        strokeWidth="3.6"
        strokeLinejoin="round"
      />
      {/* shine */}
      <path
        d="M30 38 C 30 50, 38 58, 44 62"
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <ellipse cx="34" cy="36" rx="4" ry="6" fill="rgba(255,255,255,0.55)" />
    </g>
  );
}

function BrainOrgan() {
  // Blue brain — central seam + lobed folds.
  const fill = colorHex.blue;
  const dark = colorDark.blue;
  return (
    <g stroke={INK} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round">
      {/* outer cloud silhouette */}
      <path
        d="M50 16
           C 38 12, 26 18, 26 28
           C 18 30, 14 40, 20 46
           C 14 52, 18 62, 28 64
           C 28 74, 40 80, 50 76
           C 60 80, 72 74, 72 64
           C 82 62, 86 52, 80 46
           C 86 40, 82 30, 74 28
           C 74 18, 62 12, 50 16 Z"
        fill={fill}
      />
      {/* center seam */}
      <path d="M50 18 L 50 76" fill="none" />
      {/* left folds */}
      <path d="M32 28 C 38 32, 36 38, 32 40" fill="none" stroke={dark} strokeWidth="2.6" />
      <path d="M28 44 C 36 46, 36 52, 30 56" fill="none" stroke={dark} strokeWidth="2.6" />
      <path d="M34 60 C 40 62, 42 68, 38 72" fill="none" stroke={dark} strokeWidth="2.6" />
      {/* right folds */}
      <path d="M68 28 C 62 32, 64 38, 68 40" fill="none" stroke={dark} strokeWidth="2.6" />
      <path d="M72 44 C 64 46, 64 52, 70 56" fill="none" stroke={dark} strokeWidth="2.6" />
      <path d="M66 60 C 60 62, 58 68, 62 72" fill="none" stroke={dark} strokeWidth="2.6" />
      {/* shine */}
      <ellipse cx="36" cy="26" rx="5" ry="3" fill="rgba(255,255,255,0.6)" stroke="none" />
    </g>
  );
}

function StomachOrgan() {
  // Green stomach — J-shaped sack with esophagus stub and duodenum.
  const fill = colorHex.green;
  const dark = colorDark.green;
  return (
    <g stroke={INK} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round">
      {/* esophagus stub */}
      <path d="M44 14 L 44 24" fill="none" />
      {/* body — fundus on top-left, antrum on bottom-right curving up */}
      <path
        d="M44 22
           C 30 22, 22 30, 24 44
           C 22 56, 30 76, 50 80
           C 64 82, 76 74, 76 62
           C 76 56, 70 54, 64 56
           C 60 58, 58 60, 58 50
           C 60 38, 60 28, 50 22 Z"
        fill={fill}
      />
      {/* duodenum hook */}
      <path
        d="M70 60 C 76 62, 80 70, 76 76"
        fill="none"
        strokeWidth="3.4"
      />
      {/* highlight folds */}
      <path d="M34 36 C 40 40, 46 38, 50 34" fill="none" stroke={dark} strokeWidth="2.4" />
      <path d="M32 50 C 40 56, 50 56, 56 50" fill="none" stroke={dark} strokeWidth="2.4" />
      <ellipse cx="38" cy="32" rx="4" ry="6" fill="rgba(255,255,255,0.55)" stroke="none" />
    </g>
  );
}

function BoneOrgan() {
  // Yellow bone — classic dog-bone on a slight diagonal.
  return (
    <g transform="translate(50 50) rotate(-22)" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round">
      {/* top knob pair */}
      <circle cx="-10" cy="-30" r="9" fill="#fbf6e4" />
      <circle cx="10" cy="-30" r="9" fill="#fbf6e4" />
      {/* bottom knob pair */}
      <circle cx="-10" cy="30" r="9" fill="#fbf6e4" />
      <circle cx="10" cy="30" r="9" fill="#fbf6e4" />
      {/* shaft connecting the knobs */}
      <rect x="-9" y="-26" width="18" height="52" fill="#fbf6e4" stroke="none" />
      {/* trace the dog-bone outline so corners read crisply */}
      <path
        d="M-10 -39
           C -16 -39, -19 -36, -19 -30
           C -19 -26, -17 -23, -13 -22
           L -13 22
           C -17 23, -19 26, -19 30
           C -19 36, -16 39, -10 39
           C -7 39, -4 37, -3 34
           C -2 37, 1 39, 4 39
           C 7 39, 10 37, 10 34
           L 10 -34
           C 10 -37, 7 -39, 4 -39
           C 1 -39, -2 -37, -3 -34
           C -4 -37, -7 -39, -10 -39 Z"
        fill="none"
      />
      {/* shine streak */}
      <path d="M-2 -22 L -2 22" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
    </g>
  );
}

function MultiOrgan() {
  // Multi-color cartoon zombie — pale body, colored organs visible through
  // a transparent torso. Stylized to match the rainbow multi card reference.
  return (
    <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      {/* head */}
      <ellipse cx="50" cy="22" rx="11" ry="12" fill="#cdbac0" />
      {/* hair tuft */}
      <path d="M40 18 C 46 12, 54 12, 60 18 L 58 22 L 42 22 Z" fill="#5b4a55" stroke="none" />
      {/* eyes */}
      <circle cx="46" cy="22" r="1.6" fill={INK} stroke="none" />
      <circle cx="54" cy="22" r="1.6" fill={INK} stroke="none" />
      <path d="M44 20 L 49 22" fill="none" />
      <path d="M51 22 L 56 20" fill="none" />
      {/* zigzag stitched mouth */}
      <path d="M44 28 L 46 30 L 48 28 L 50 30 L 52 28 L 54 30 L 56 28" fill="none" strokeWidth="1.6" />

      {/* neck */}
      <path d="M46 34 L 46 38 L 54 38 L 54 34" fill="#cdbac0" />

      {/* torso */}
      <path
        d="M34 40
           L 66 40
           L 64 70
           L 56 70
           L 54 86
           L 46 86
           L 44 70
           L 36 70 Z"
        fill="#cdbac0"
      />
      {/* arms */}
      <path d="M34 42 L 26 60 L 30 72" fill="none" />
      <path d="M66 42 L 74 60 L 70 72" fill="none" />
      {/* hand stubs */}
      <circle cx="30" cy="72" r="2.6" fill="#cdbac0" />
      <circle cx="70" cy="72" r="2.6" fill="#cdbac0" />

      {/* legs */}
      <path d="M46 86 L 44 92" fill="none" />
      <path d="M54 86 L 56 92" fill="none" />
      <circle cx="44" cy="93" r="2.4" fill="#cdbac0" />
      <circle cx="56" cy="93" r="2.4" fill="#cdbac0" />

      {/* organs showing through torso */}
      {/* red heart */}
      <path
        d="M44 50
           C 38 46, 38 42, 42 41
           C 44 40.5, 45.5 42, 46 43
           C 46.5 42, 48 40.5, 50 41
           C 54 42, 54 46, 48 50
           Z"
        fill="var(--c-red)"
        strokeWidth="1.8"
      />
      {/* green stomach */}
      <path
        d="M54 56
           C 48 56, 46 60, 50 64
           C 54 67, 60 65, 59 60
           C 59 57, 58 56, 54 56 Z"
        fill="var(--c-green)"
        strokeWidth="1.8"
      />
      {/* yellow bone vertical line */}
      <line x1="50" y1="68" x2="50" y2="78" stroke="#fbf6e4" strokeWidth="2.8" />
      <circle cx="50" cy="68" r="1.8" fill="#fbf6e4" stroke={INK} strokeWidth="1.2" />
      <circle cx="50" cy="78" r="1.8" fill="#fbf6e4" stroke={INK} strokeWidth="1.2" />
    </g>
  );
}

function OrganGlyph({ color }: { color: Color }) {
  if (color === "red") return <HeartOrgan />;
  if (color === "blue") return <BrainOrgan />;
  if (color === "green") return <StomachOrgan />;
  if (color === "yellow") return <BoneOrgan />;
  return <MultiOrgan />;
}

/* =========================================================================
   VIRUS / MEDICINE / TREATMENT — kept from the previous design, lightly
   updated so they read on the new paper-panel frame.
   ========================================================================= */

function VirusGlyph({ color }: { color: Color }) {
  const fill = colorHex[color];
  const dark = colorDark[color];
  return (
    <g>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const x1 = 50 + Math.cos(a) * 26, y1 = 50 + Math.sin(a) * 26;
        const x2 = 50 + Math.cos(a) * 40, y2 = 50 + Math.sin(a) * 40;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="4" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="3.6" fill={dark} stroke={INK} strokeWidth="2" />
          </g>
        );
      })}
      <circle cx="50" cy="50" r="26" fill={fill} stroke={INK} strokeWidth="3.6" />
      <circle cx="42" cy="44" r="3" fill={INK} />
      <circle cx="58" cy="44" r="3" fill={INK} />
      <path d="M40 58 Q 50 52 60 58" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="40" cy="36" rx="6" ry="4" fill="rgba(255,255,255,0.6)" />
    </g>
  );
}

function MedicineGlyph({ color }: { color: Color }) {
  const fill = colorHex[color];
  return (
    <g transform="translate(50 50) rotate(-25)">
      <rect x="-30" y="-14" width="60" height="28" rx="14" fill={PAPER} stroke={INK} strokeWidth="3.6" />
      <path d="M-30 -14 L 0 -14 L 0 14 L -30 14 Z" fill={fill} stroke={INK} strokeWidth="3.6" />
      <ellipse cx="-18" cy="-6" rx="6" ry="3" fill="rgba(255,255,255,0.6)" />
      <line x1="0" y1="-14" x2="0" y2="14" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function TransplantGlyph() {
  return (
    <g>
      <path d="M30 60 L 50 30 L 70 60 Z" fill="var(--c-blue)" stroke={INK} strokeWidth="3" />
      <path d="M30 36 L 50 66 L 70 36 Z" fill="var(--c-red)" stroke={INK} strokeWidth="3" opacity="0.85" />
      <path d="M22 50 L 38 50 L 38 46 L 46 52 L 38 58 L 38 54 L 22 54 Z" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <path d="M78 50 L 62 50 L 62 46 L 54 52 L 62 58 L 62 54 L 78 54 Z" fill={PAPER} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

function OrganThiefGlyph() {
  return (
    <g>
      <path d="M22 40 Q 50 24 78 40 Q 78 60 50 62 Q 22 60 22 40 Z" fill={INK} stroke={INK} strokeWidth="3" />
      <circle cx="38" cy="46" r="6" fill={PAPER} />
      <circle cx="62" cy="46" r="6" fill={PAPER} />
      <circle cx="38" cy="46" r="2.5" fill={INK} />
      <circle cx="62" cy="46" r="2.5" fill={INK} />
      <path d="M30 70 L 50 82 L 70 70 L 64 78 L 50 86 L 36 78 Z" fill="var(--c-yellow)" stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

function ContagionGlyph() {
  return (
    <g>
      {[[30, 40], [62, 34], [44, 62], [70, 62]].map(([cx, cy], i) => (
        <g key={i}>
          {Array.from({ length: 6 }).map((_, k) => {
            const a = (k / 6) * Math.PI * 2;
            const x2 = cx + Math.cos(a) * 14, y2 = cy + Math.sin(a) * 14;
            return <line key={k} x1={cx} y1={cy} x2={x2} y2={y2} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />;
          })}
          <circle cx={cx} cy={cy} r="8" fill="var(--c-red)" stroke={INK} strokeWidth="2.5" />
        </g>
      ))}
      <path d="M30 40 Q 46 30 62 34" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="3 3" />
      <path d="M62 34 Q 66 52 70 62" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="3 3" />
    </g>
  );
}

function LatexGloveGlyph() {
  return (
    <g>
      <path
        d="M36 20 C 32 24, 32 38, 32 44 L 26 46 L 24 62 C 22 72, 30 86, 44 86 L 60 86 C 72 86, 76 76, 76 68 L 74 52 C 74 46, 76 40, 76 32 C 76 24, 70 20, 64 24 L 60 34 L 58 24 C 56 18, 50 18, 50 24 L 50 34 L 46 24 C 44 18, 38 16, 36 20 Z"
        fill="#a8e0ff"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M40 62 Q 50 68 60 62" fill="none" stroke={INK} strokeWidth="2" />
      <ellipse cx="44" cy="42" rx="5" ry="10" fill="rgba(255,255,255,0.55)" />
    </g>
  );
}

function MedicalErrorGlyph() {
  return (
    <g>
      <path d="M22 38 L 42 38 L 42 30 L 56 42 L 42 54 L 42 46 L 22 46 Z" fill="var(--c-red)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 66 L 58 66 L 58 74 L 44 62 L 58 50 L 58 58 L 78 58 Z" fill="var(--c-green)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

function TreatmentGlyph({ kind }: { kind: TreatmentKind }) {
  switch (kind) {
    case "transplant":     return <TransplantGlyph />;
    case "organ_thief":    return <OrganThiefGlyph />;
    case "contagion":      return <ContagionGlyph />;
    case "latex_glove":    return <LatexGloveGlyph />;
    case "medical_error":  return <MedicalErrorGlyph />;
  }
}

export function CardPictogram({ card, size }: { card: Card; size?: number }) {
  const sizing = size ? { width: size, height: size } : { width: "100%" as const, height: "100%" as const };
  return (
    <svg viewBox="0 0 100 100" {...sizing} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="multi-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--c-red)" />
          <stop offset="33%" stopColor="var(--c-yellow)" />
          <stop offset="66%" stopColor="var(--c-green)" />
          <stop offset="100%" stopColor="var(--c-blue)" />
        </linearGradient>
      </defs>
      {card.type === "organ" && <OrganGlyph color={card.color} />}
      {card.type === "virus" && <VirusGlyph color={card.color} />}
      {card.type === "medicine" && <MedicineGlyph color={card.color} />}
      {card.type === "treatment" && card.treatment_kind && <TreatmentGlyph kind={card.treatment_kind} />}
    </svg>
  );
}

/* Number badge value — matches the canonical Virus! deck distribution. */
export function cardCount(card: Card): number {
  if (card.type === "organ") return card.color === "multi" ? 1 : 5;
  if (card.type === "virus") return card.color === "multi" ? 1 : 4;
  if (card.type === "medicine") return 4;
  // treatments
  const t: Record<TreatmentKind, number> = {
    transplant: 3,
    organ_thief: 1,
    contagion: 2,
    latex_glove: 1,
    medical_error: 3,
  };
  return card.treatment_kind ? t[card.treatment_kind] : 1;
}

export function cardLabel(card: Card): string {
  if (card.type === "treatment") {
    const map: Record<TreatmentKind, string> = {
      transplant: "Transplant",
      organ_thief: "Organ Thief",
      contagion: "Contagion",
      latex_glove: "Latex Glove",
      medical_error: "Medical Error",
    };
    return card.treatment_kind ? map[card.treatment_kind] : "Treatment";
  }
  return card.type.charAt(0).toUpperCase() + card.type.slice(1);
}
