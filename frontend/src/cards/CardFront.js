import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
import { CardPictogram, cardCount } from "./Pictograms";
/* =========================================================================
   Card front — exact replica of sources/card_design/*.png:

   - Outer textured colored border (painterly grain via SVG turbulence)
   - Inner cream paper panel with double dark border
   - Sunburst rays radiating from center
   - Bold hand-drawn central icon
   - Heart suit pip top-left, spade suit pip bottom-right
   - White circular number badge top-right

   Sized in a 200×300 SVG so every internal dimension scales with the card's
   outer `h` prop without re-tuning.
   ========================================================================= */
const INK = "#1a120c";
const PAPER = "#f3ead7";
const colorVar = {
    red: "var(--c-red)",
    green: "var(--c-green)",
    blue: "var(--c-blue)",
    yellow: "var(--c-yellow)",
    multi: "var(--c-red)",
};
const colorDarkVar = {
    red: "var(--c-red-d)",
    green: "var(--c-green-d)",
    blue: "var(--c-blue-d)",
    yellow: "var(--c-yellow-d)",
    multi: "var(--c-red-d)",
};
export function CardFront({ card, h = "clamp(140px, 22vh, 200px)", }) {
    const isTreatment = card.type === "treatment";
    const cardColor = isTreatment ? "multi" : card.color;
    const uid = useId().replace(/:/g, "");
    const grainId = `grain-${uid}`;
    const burstId = `burst-${uid}`;
    const panelClipId = `panel-${uid}`;
    const rainbowId = `rainbow-${uid}`;
    const innerShadowId = `inshadow-${uid}`;
    const borderFill = cardColor === "multi" ? `url(#${rainbowId})` : colorVar[cardColor];
    const borderDark = colorDarkVar[cardColor];
    return (_jsxs("div", { className: "relative overflow-hidden select-none card-face-3d backface-hidden", style: {
            height: h,
            aspectRatio: "2 / 3",
            borderRadius: "calc(var(--h) / 18)",
            // @ts-expect-error CSS var
            "--h": h,
            boxShadow: "0 calc(var(--h) / 18) calc(var(--h) / 6) calc(var(--h) / -18) rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.3)",
        }, children: [_jsxs("svg", { viewBox: "0 0 200 300", preserveAspectRatio: "xMidYMid meet", style: { width: "100%", height: "100%", display: "block" }, "aria-hidden": true, children: [_jsxs("defs", { children: [_jsxs("filter", { id: grainId, x: "0", y: "0", width: "100%", height: "100%", children: [_jsx("feTurbulence", { type: "fractalNoise", baseFrequency: "0.85", numOctaves: "2", seed: "7" }), _jsx("feColorMatrix", { values: "0 0 0 0 0\n                      0 0 0 0 0\n                      0 0 0 0 0\n                      0 0 0 0.45 0" }), _jsx("feComposite", { in2: "SourceGraphic", operator: "in" })] }), _jsxs("linearGradient", { id: rainbowId, x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--c-red)" }), _jsx("stop", { offset: "30%", stopColor: "var(--c-yellow)" }), _jsx("stop", { offset: "55%", stopColor: "var(--c-green)" }), _jsx("stop", { offset: "80%", stopColor: "var(--c-blue)" }), _jsx("stop", { offset: "100%", stopColor: "var(--c-red)" })] }), _jsxs("linearGradient", { id: "multi-grad", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--c-red)" }), _jsx("stop", { offset: "33%", stopColor: "var(--c-yellow)" }), _jsx("stop", { offset: "66%", stopColor: "var(--c-green)" }), _jsx("stop", { offset: "100%", stopColor: "var(--c-blue)" })] }), _jsxs("radialGradient", { id: innerShadowId, cx: "50%", cy: "50%", r: "70%", children: [_jsx("stop", { offset: "60%", stopColor: "rgba(0,0,0,0)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(60,30,10,0.22)" })] }), _jsx("clipPath", { id: panelClipId, children: _jsx("rect", { x: "18", y: "22", width: "164", height: "256", rx: "14" }) })] }), _jsx("rect", { x: "0", y: "0", width: "200", height: "300", rx: "14", fill: borderFill }), _jsx("rect", { x: "0", y: "0", width: "200", height: "300", rx: "14", fill: borderDark, filter: `url(#${grainId})`, opacity: "0.55" }), _jsx("rect", { x: "0", y: "0", width: "200", height: "300", rx: "14", fill: "rgba(255,255,255,0.35)", filter: `url(#${grainId})`, opacity: "0.35" }), _jsx("rect", { x: "0", y: "0", width: "200", height: "300", rx: "14", fill: "rgba(0,0,0,0.18)", style: {
                            mask: "radial-gradient(ellipse at 50% 50%, transparent 30%, black 90%)",
                            WebkitMask: "radial-gradient(ellipse at 50% 50%, transparent 30%, black 90%)",
                        } }), _jsx("rect", { x: "18", y: "22", width: "164", height: "256", rx: "14", fill: PAPER, stroke: INK, strokeWidth: "2.5" }), _jsx("rect", { x: "23", y: "27", width: "154", height: "246", rx: "10", fill: "none", stroke: INK, strokeWidth: "1.2", opacity: "0.85" }), _jsxs("g", { clipPath: `url(#${panelClipId})`, children: [_jsx(Sunburst, { color: cardColor, id: burstId }), _jsx("rect", { x: "18", y: "22", width: "164", height: "256", rx: "14", fill: `url(#${innerShadowId})` }), _jsx("svg", { x: "45", y: "95", width: "110", height: "110", viewBox: "0 0 100 100", overflow: "visible", children: _jsx(CardPictogram, { card: card }) })] }), _jsx("g", { transform: "translate(16 16)", children: _jsx(SuitHeart, {}) }), _jsx("g", { transform: "translate(184 284) rotate(180)", children: _jsx(SuitSpade, {}) }), _jsxs("g", { transform: "translate(165 30)", children: [_jsx("circle", { r: "20", fill: "#fdfaf1", stroke: INK, strokeWidth: "2.4" }), _jsx("circle", { r: "20", cx: "0.5", cy: "1.5", fill: "none", stroke: "rgba(0,0,0,0.12)", strokeWidth: "3" }), _jsx("text", { x: "0", y: "1", textAnchor: "middle", dominantBaseline: "central", fontSize: "24", fontWeight: 900, fontFamily: '"Bangers", "Luckiest Guy", system-ui, sans-serif', fill: INK, children: cardCount(card) })] })] }), _jsx("div", { className: "pointer-events-none absolute inset-0", style: {
                    borderRadius: "inherit",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.16) 100%)",
                } })] }));
}
/* -------------------------------------------------------------------------
   Sunburst — alternating colored / lighter triangular rays radiating from
   the panel center. Uses the card's accent color, with a lighter tint on
   alternating spokes.
   ------------------------------------------------------------------------- */
function Sunburst({ color, id }) {
    const cx = 100;
    const cy = 150;
    const r = 260; // big enough to overshoot panel; clipped anyway
    const spokes = 24;
    const base = color === "multi" ? "var(--c-yellow)" : colorVar[color];
    const tint = color === "multi" ? "var(--c-red)" : colorDarkVar[color];
    const rays = [];
    for (let i = 0; i < spokes; i++) {
        const a1 = ((i - 0.45) / spokes) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 0.45) / spokes) * Math.PI * 2 - Math.PI / 2;
        const p1x = cx + Math.cos(a1) * r;
        const p1y = cy + Math.sin(a1) * r;
        const p2x = cx + Math.cos(a2) * r;
        const p2y = cy + Math.sin(a2) * r;
        rays.push(_jsx("polygon", { points: `${cx},${cy} ${p1x},${p1y} ${p2x},${p2y}`, fill: i % 2 === 0 ? base : tint, opacity: i % 2 === 0 ? 0.55 : 0.35 }, i));
    }
    return (_jsxs("g", { children: [_jsx("rect", { x: "18", y: "22", width: "164", height: "256", rx: "14", fill: base, opacity: "0.18" }), _jsx("g", { id: id, style: { mixBlendMode: "multiply" }, children: rays }), _jsx("circle", { cx: cx, cy: cy, r: "62", fill: PAPER, opacity: "0.55" })] }));
}
/* -------------------------------------------------------------------------
   Suit pips — small heart and spade icons used in the card corners, drawn
   on a tiny local coordinate system.
   ------------------------------------------------------------------------- */
function SuitHeart() {
    return (_jsxs("g", { children: [_jsx("circle", { r: "10", cx: "6", cy: "6", fill: "#fdfaf1", stroke: INK, strokeWidth: "1.6" }), _jsx("path", { d: "M6 11\n           C 1 7, 0 4, 2.5 2.5\n           C 4 1.6, 5.5 2.8, 6 4\n           C 6.5 2.8, 8 1.6, 9.5 2.5\n           C 12 4, 11 7, 6 11 Z", fill: INK })] }));
}
function SuitSpade() {
    return (_jsxs("g", { children: [_jsx("circle", { r: "10", cx: "6", cy: "6", fill: "#fdfaf1", stroke: INK, strokeWidth: "1.6" }), _jsx("path", { d: "M6 1\n           C 9 4, 12 6, 11 8.5\n           C 10.4 10, 8.6 10, 7.5 9\n           L 8 11\n           L 4 11\n           L 4.5 9\n           C 3.4 10, 1.6 10, 1 8.5\n           C 0 6, 3 4, 6 1 Z", fill: INK })] }));
}
