// Shared bits of the pre-game screens: the brand header and the hero fan of real card faces.
import { useEffect, useRef, type ReactNode } from "react";
import { CARD_TYPES, paintCardCanvas } from "../cards/textures";

export function PregameHeader({ subtitle, children }: { subtitle: string; children?: ReactNode }) {
  return (
    <header className="top">
      <div className="brand">
        <h1>
          Antibody <span>Politics</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="controls">{children}</div>}
    </header>
  );
}

/** One card face painted from `cards/textures.ts`, repainted once the display font arrives. */
function CardCanvas({ typeKey, width }: { typeKey: string; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const px = Math.round(width * Math.min(2, window.devicePixelRatio || 1));
    const paint = () => paintCardCanvas(cv, typeKey, px);
    paint();
    let live = true;
    document.fonts?.load('40px "Bowlby One"').then(() => live && paint(), () => {});
    return () => {
      live = false;
    };
  }, [typeKey, width]);
  return <canvas ref={ref} className="pg-card-cv" aria-hidden="true" />;
}

const HERO = ["organ-red", "virus-green", "medicine-blue", "treatment-thief", "organ-multi"];

/** Fanned hand of five real cards; hover spreads it a little (off under reduced motion). */
export function CardFan({ keys = HERO, width = 150 }: { keys?: string[]; width?: number }) {
  const mid = (keys.length - 1) / 2;
  const names = keys.map((k) => CARD_TYPES.get(k)?.name ?? k);
  return (
    <div className="pg-fan" role="img" aria-label={`Cards from the game: ${names.join(", ")}`}>
      {keys.map((k, i) => (
        <div
          key={k}
          className="pg-card"
          title={names[i]}
          style={{ ["--o" as string]: i - mid, ["--i" as string]: i }}
        >
          <CardCanvas typeKey={k} width={width} />
        </div>
      ))}
    </div>
  );
}
