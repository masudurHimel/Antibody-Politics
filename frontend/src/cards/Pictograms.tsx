import type { Card, Color, TreatmentKind } from "../game/types";

const STROKE = "#1a1410";
const HI = "rgba(255,255,255,0.45)";

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

function Defs() {
  return (
    <defs>
      <linearGradient id="multi-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--c-red)" />
        <stop offset="33%" stopColor="var(--c-yellow)" />
        <stop offset="66%" stopColor="var(--c-green)" />
        <stop offset="100%" stopColor="var(--c-blue)" />
      </linearGradient>
      <radialGradient id="shine" cx="30%" cy="20%" r="60%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>
    </defs>
  );
}

// Organ: cartoon body part icon depending on color (heart/lung/stomach/brain)
function OrganGlyph({ color }: { color: Color }) {
  const fill = colorHex[color];
  const dark = colorDark[color];
  // Use distinct silhouette per color so each organ feels unique
  if (color === "red") {
    // Heart
    return (
      <g>
        <path
          d="M50 86 C 18 64, 8 42, 22 26 C 32 14, 46 18, 50 30 C 54 18, 68 14, 78 26 C 92 42, 82 64, 50 86 Z"
          fill={fill}
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M30 38 C 30 48, 38 56, 46 60" fill="none" stroke={HI} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (color === "green") {
    // Stomach
    return (
      <g>
        <path
          d="M28 30 C 24 22, 32 12, 44 14 L 60 16 C 76 18, 84 28, 80 44 L 76 64 C 72 80, 56 86, 42 80 C 28 74, 22 60, 26 48 Z"
          fill={fill}
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M38 36 C 44 42, 52 42, 60 38" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
        <path d="M36 52 C 46 60, 58 60, 70 52" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (color === "blue") {
    // Lungs (twin lobes)
    return (
      <g>
        <path d="M50 16 L 50 70" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M48 24 C 28 26, 18 44, 22 64 C 24 76, 38 82, 48 72 Z"
          fill={fill}
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M52 24 C 72 26, 82 44, 78 64 C 76 76, 62 82, 52 72 Z"
          fill={fill}
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  if (color === "yellow") {
    // Brain
    return (
      <g>
        <path
          d="M30 28 C 24 18, 38 10, 50 14 C 62 10, 76 18, 70 28 C 82 32, 82 50, 70 54 C 72 70, 56 78, 50 70 C 44 78, 28 70, 30 54 C 18 50, 18 32, 30 28 Z"
          fill={fill}
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M50 22 L 50 70" stroke={STROKE} strokeWidth="3" />
        <path d="M38 28 C 42 38, 38 48, 42 58" fill="none" stroke={dark} strokeWidth="2.5" />
        <path d="M62 28 C 58 38, 62 48, 58 58" fill="none" stroke={dark} strokeWidth="2.5" />
      </g>
    );
  }
  // multi-color organ — wildcard
  return (
    <g>
      <circle cx="50" cy="48" r="32" fill={fill} stroke={STROKE} strokeWidth="3.5" />
      <text x="50" y="58" textAnchor="middle" fontSize="34" fontWeight="900" fill={STROKE}>★</text>
    </g>
  );
}

// Virus: spiky germ
function VirusGlyph({ color }: { color: Color }) {
  const fill = colorHex[color];
  const dark = colorDark[color];
  return (
    <g>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const x1 = 50 + Math.cos(a) * 26, y1 = 48 + Math.sin(a) * 26;
        const x2 = 50 + Math.cos(a) * 38, y2 = 48 + Math.sin(a) * 38;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="3.5" fill={dark} stroke={STROKE} strokeWidth="2" />
          </g>
        );
      })}
      <circle cx="50" cy="48" r="26" fill={fill} stroke={STROKE} strokeWidth="3.5" />
      <circle cx="42" cy="42" r="3" fill={STROKE} />
      <circle cx="58" cy="42" r="3" fill={STROKE} />
      <path d="M40 56 Q 50 50 60 56" fill="none" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="34" r="6" fill={HI} />
    </g>
  );
}

// Medicine: pill capsule
function MedicineGlyph({ color }: { color: Color }) {
  const fill = colorHex[color];
  return (
    <g transform="translate(50 48) rotate(-25)">
      <rect x="-30" y="-14" width="60" height="28" rx="14" fill="#fbf6ec" stroke={STROKE} strokeWidth="3.5" />
      <path d="M-30 -14 L 0 -14 L 0 14 L -30 14 Z" fill={fill} stroke={STROKE} strokeWidth="3.5" />
      <ellipse cx="-18" cy="-6" rx="6" ry="3" fill={HI} />
      <line x1="0" y1="-14" x2="0" y2="14" stroke={STROKE} strokeWidth="3" />
    </g>
  );
}

// Treatments — one distinct glyph each
function TransplantGlyph() {
  return (
    <g>
      <path d="M30 60 L 50 30 L 70 60 Z" fill="var(--c-blue)" stroke={STROKE} strokeWidth="3" />
      <path d="M30 36 L 50 66 L 70 36 Z" fill="var(--c-red)" stroke={STROKE} strokeWidth="3" opacity="0.85" />
      <path d="M22 48 L 38 48 L 38 44 L 46 50 L 38 56 L 38 52 L 22 52 Z" fill="#fbf6ec" stroke={STROKE} strokeWidth="2.5" />
      <path d="M78 48 L 62 48 L 62 44 L 54 50 L 62 56 L 62 52 L 78 52 Z" fill="#fbf6ec" stroke={STROKE} strokeWidth="2.5" />
    </g>
  );
}

function OrganThiefGlyph() {
  return (
    <g>
      {/* mask */}
      <path d="M22 38 Q 50 22 78 38 Q 78 58 50 60 Q 22 58 22 38 Z" fill="#1a1410" stroke={STROKE} strokeWidth="3" />
      <circle cx="38" cy="44" r="6" fill="#fbf6ec" />
      <circle cx="62" cy="44" r="6" fill="#fbf6ec" />
      <circle cx="38" cy="44" r="2.5" fill={STROKE} />
      <circle cx="62" cy="44" r="2.5" fill={STROKE} />
      {/* hand grabbing */}
      <path d="M30 68 L 50 80 L 70 68 L 64 76 L 50 84 L 36 76 Z" fill="var(--c-yellow)" stroke={STROKE} strokeWidth="2.5" />
    </g>
  );
}

function ContagionGlyph() {
  return (
    <g>
      {/* small spreading viruses */}
      {[[30, 38], [62, 32], [44, 60], [70, 60]].map(([cx, cy], i) => (
        <g key={i}>
          {Array.from({ length: 6 }).map((_, k) => {
            const a = (k / 6) * Math.PI * 2;
            const x2 = cx + Math.cos(a) * 14, y2 = cy + Math.sin(a) * 14;
            return <line key={k} x1={cx} y1={cy} x2={x2} y2={y2} stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />;
          })}
          <circle cx={cx} cy={cy} r="8" fill="var(--c-red)" stroke={STROKE} strokeWidth="2.5" />
        </g>
      ))}
      <path d="M30 38 Q 46 28 62 32" fill="none" stroke={STROKE} strokeWidth="2" strokeDasharray="3 3" />
      <path d="M62 32 Q 66 50 70 60" fill="none" stroke={STROKE} strokeWidth="2" strokeDasharray="3 3" />
    </g>
  );
}

function LatexGloveGlyph() {
  return (
    <g>
      <path
        d="M36 18 C 32 22, 32 36, 32 42 L 26 44 L 24 60 C 22 70, 30 84, 44 84 L 60 84 C 72 84, 76 74, 76 66 L 74 50 C 74 44, 76 38, 76 30 C 76 22, 70 18, 64 22 L 60 32 L 58 22 C 56 16, 50 16, 50 22 L 50 32 L 46 22 C 44 16, 38 14, 36 18 Z"
        fill="#a8e0ff"
        stroke={STROKE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M40 60 Q 50 66 60 60" fill="none" stroke={STROKE} strokeWidth="2" />
      <ellipse cx="44" cy="40" rx="5" ry="10" fill={HI} />
    </g>
  );
}

function MedicalErrorGlyph() {
  // body swap / shuffle arrows
  return (
    <g>
      <path d="M22 36 L 42 36 L 42 28 L 56 40 L 42 52 L 42 44 L 22 44 Z" fill="var(--c-red)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 60 L 58 60 L 58 68 L 44 56 L 58 44 L 58 52 L 78 52 Z" fill="var(--c-green)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" opacity="0" />
      <path d="M78 64 L 58 64 L 58 72 L 44 60 L 58 48 L 58 56 L 78 56 Z" fill="var(--c-green)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
      <text x="50" y="86" textAnchor="middle" fontSize="11" fontWeight="900" fill={STROKE}>SWAP</text>
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
      <Defs />
      {card.type === "organ" && <OrganGlyph color={card.color} />}
      {card.type === "virus" && <VirusGlyph color={card.color} />}
      {card.type === "medicine" && <MedicineGlyph color={card.color} />}
      {card.type === "treatment" && card.treatment_kind && <TreatmentGlyph kind={card.treatment_kind} />}
    </svg>
  );
}

// Card type label
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

export function cardCorner(card: Card): string {
  if (card.type === "organ") return "O";
  if (card.type === "virus") return "V";
  if (card.type === "medicine") return "M";
  return "T";
}
