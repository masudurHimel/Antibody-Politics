// Procedural cartoon avatar — fully inline SVG, deterministic from `seed`.
// Different seeds produce different faces. Uses the same chunky stroke style
// as the card pictograms so it sits naturally on the board.

const STROKE = "#1a1410";

const SKIN = ["#f4c8a1", "#e8a87c", "#c98a5a", "#8c5a3a", "#5c3a23", "#f5d4b3"];
const HAIR = ["#1a1410", "#5a3a20", "#a85a2a", "#d9a13a", "#7a7a7a", "#e8e0d0"];
const SHIRT = ["#c84141", "#3aa15a", "#3a78c8", "#f5c43a", "#9a5ad9", "#2fb6b0"];
const BG = ["#1f4d34", "#3a2a4f", "#4a2a2a", "#2a3a4a", "#3a4a2a", "#4a3a2a"];

const EYES = ["round", "happy", "wink", "dot", "starry", "shades"] as const;
const MOUTHS = ["smile", "grin", "smirk", "ooo", "neutral", "tongue"] as const;
const HAIRSTYLES = ["short", "bun", "mohawk", "afro", "bald", "cap", "side"] as const;
const ACCESSORIES = ["none", "none", "glasses", "headphones", "beauty-mark"] as const;

type Eye = (typeof EYES)[number];
type Mouth = (typeof MOUTHS)[number];
type HairStyle = (typeof HAIRSTYLES)[number];
type Accessory = (typeof ACCESSORIES)[number];

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWith<T>(arr: readonly T[], h: number, salt: number): T {
  const mixed = ((h ^ Math.imul(salt, 2654435761)) >>> 0) % arr.length;
  return arr[mixed];
}

function looks(seed: string) {
  const h = hashString(seed);
  return {
    skin: pickWith(SKIN, h, 1),
    hair: pickWith(HAIR, h, 2),
    shirt: pickWith(SHIRT, h, 3),
    bg: pickWith(BG, h, 4),
    eyes: pickWith(EYES, h, 5) as Eye,
    mouth: pickWith(MOUTHS, h, 6) as Mouth,
    hairStyle: pickWith(HAIRSTYLES, h, 7) as HairStyle,
    accessory: pickWith(ACCESSORIES, h, 8) as Accessory,
    blush: (h & 1) === 1,
  };
}

function Eyes({ kind, color }: { kind: Eye; color: string }) {
  if (kind === "happy")
    return (
      <g fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round">
        <path d="M34 52 Q 40 46 46 52" />
        <path d="M54 52 Q 60 46 66 52" />
      </g>
    );
  if (kind === "wink")
    return (
      <g>
        <circle cx="40" cy="52" r="4" fill={STROKE} />
        <path d="M54 52 Q 60 46 66 52" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  if (kind === "dot")
    return (
      <g fill={STROKE}>
        <circle cx="40" cy="52" r="3" />
        <circle cx="60" cy="52" r="3" />
      </g>
    );
  if (kind === "starry")
    return (
      <g fill={color} stroke={STROKE} strokeWidth="2">
        <path d="M40 46 L 42 52 L 47 53 L 42 55 L 40 60 L 38 55 L 33 53 L 38 52 Z" />
        <path d="M60 46 L 62 52 L 67 53 L 62 55 L 60 60 L 58 55 L 53 53 L 58 52 Z" />
      </g>
    );
  if (kind === "shades")
    return (
      <g>
        <rect x="30" y="46" width="18" height="12" rx="3" fill={STROKE} />
        <rect x="52" y="46" width="18" height="12" rx="3" fill={STROKE} />
        <path d="M48 52 L 52 52" stroke={STROKE} strokeWidth="3" />
      </g>
    );
  // round
  return (
    <g>
      <circle cx="40" cy="52" r="5" fill="white" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="60" cy="52" r="5" fill="white" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="41" cy="53" r="2" fill={STROKE} />
      <circle cx="61" cy="53" r="2" fill={STROKE} />
    </g>
  );
}

function Mouth({ kind }: { kind: Mouth }) {
  if (kind === "grin")
    return <path d="M38 70 Q 50 80 62 70 L 38 70 Z" fill="white" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />;
  if (kind === "smirk")
    return <path d="M40 72 Q 52 76 60 70" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />;
  if (kind === "ooo")
    return <ellipse cx="50" cy="72" rx="5" ry="6" fill="#7a2a2a" stroke={STROKE} strokeWidth="2.5" />;
  if (kind === "neutral")
    return <path d="M40 72 L 60 72" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />;
  if (kind === "tongue")
    return (
      <g>
        <path d="M38 70 Q 50 80 62 70" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="54" cy="76" rx="4" ry="3" fill="#e26a8a" stroke={STROKE} strokeWidth="2" />
      </g>
    );
  // smile
  return <path d="M38 68 Q 50 78 62 68" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />;
}

function Hair({ kind, color }: { kind: HairStyle; color: string }) {
  if (kind === "bald") return null;
  if (kind === "cap")
    return (
      <g>
        <path
          d="M22 36 Q 50 14 78 36 L 78 42 L 22 42 Z"
          fill={color}
          stroke={STROKE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="22" r="3" fill="white" stroke={STROKE} strokeWidth="2" />
      </g>
    );
  if (kind === "bun")
    return (
      <g fill={color} stroke={STROKE} strokeWidth="3" strokeLinejoin="round">
        <circle cx="50" cy="18" r="10" />
        <path d="M22 40 Q 28 24 50 24 Q 72 24 78 40 L 78 46 L 22 46 Z" />
      </g>
    );
  if (kind === "mohawk")
    return (
      <path
        d="M44 12 L 56 12 L 60 38 L 40 38 Z"
        fill={color}
        stroke={STROKE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    );
  if (kind === "afro")
    return (
      <g fill={color} stroke={STROKE} strokeWidth="3" strokeLinejoin="round">
        <circle cx="50" cy="28" r="26" />
      </g>
    );
  if (kind === "side")
    return (
      <path
        d="M18 44 Q 22 22 50 20 Q 78 22 82 44 L 78 44 Q 70 30 50 30 Q 38 30 30 38 L 26 50 Q 22 50 18 44 Z"
        fill={color}
        stroke={STROKE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    );
  // short
  return (
    <path
      d="M22 42 Q 24 22 50 20 Q 76 22 78 42 L 70 38 Q 50 28 30 38 Z"
      fill={color}
      stroke={STROKE}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  );
}

function Accessory({ kind }: { kind: Accessory }) {
  if (kind === "glasses")
    return (
      <g fill="none" stroke={STROKE} strokeWidth="3">
        <circle cx="40" cy="52" r="8" />
        <circle cx="60" cy="52" r="8" />
        <path d="M48 52 L 52 52" />
      </g>
    );
  if (kind === "headphones")
    return (
      <g stroke={STROKE} strokeWidth="3" fill="#2a2a2a">
        <path d="M22 50 Q 22 26 50 26 Q 78 26 78 50" fill="none" />
        <rect x="14" y="46" width="12" height="16" rx="3" />
        <rect x="74" y="46" width="12" height="16" rx="3" />
      </g>
    );
  if (kind === "beauty-mark")
    return <circle cx="64" cy="64" r="2.5" fill={STROKE} />;
  return null;
}

export function Avatar({
  seed,
  size = 40,
  ring,
}: {
  seed: string;
  size?: number | string;
  ring?: string;
}) {
  const l = looks(seed);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ display: "block", borderRadius: "50%", boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
    >
      <circle cx="50" cy="50" r="50" fill={l.bg} />
      {/* shoulders */}
      <path d="M10 100 Q 18 78 50 78 Q 82 78 90 100 Z" fill={l.shirt} stroke={STROKE} strokeWidth="3" />
      {/* neck */}
      <rect x="44" y="68" width="12" height="14" fill={l.skin} stroke={STROKE} strokeWidth="2.5" />
      {/* head */}
      <ellipse cx="50" cy="48" rx="26" ry="28" fill={l.skin} stroke={STROKE} strokeWidth="3" />
      {/* ears */}
      <ellipse cx="24" cy="52" rx="4" ry="6" fill={l.skin} stroke={STROKE} strokeWidth="2.5" />
      <ellipse cx="76" cy="52" rx="4" ry="6" fill={l.skin} stroke={STROKE} strokeWidth="2.5" />
      {/* hair sits between head and face */}
      <Hair kind={l.hairStyle} color={l.hair} />
      {/* blush */}
      {l.blush && (
        <g fill="#e26a8a" opacity={0.55}>
          <ellipse cx="32" cy="62" rx="5" ry="3" />
          <ellipse cx="68" cy="62" rx="5" ry="3" />
        </g>
      )}
      <Eyes kind={l.eyes} color={l.hair} />
      <Mouth kind={l.mouth} />
      <Accessory kind={l.accessory} />
    </svg>
  );
}
