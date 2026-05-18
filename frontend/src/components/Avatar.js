import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Procedural cartoon avatar — fully inline SVG, deterministic from `seed`.
// Different seeds produce different faces. Uses the same chunky stroke style
// as the card pictograms so it sits naturally on the board.
const STROKE = "#1a1410";
const SKIN = ["#f4c8a1", "#e8a87c", "#c98a5a", "#8c5a3a", "#5c3a23", "#f5d4b3"];
const HAIR = ["#1a1410", "#5a3a20", "#a85a2a", "#d9a13a", "#7a7a7a", "#e8e0d0"];
const SHIRT = ["#c84141", "#3aa15a", "#3a78c8", "#f5c43a", "#9a5ad9", "#2fb6b0"];
const BG = ["#1f4d34", "#3a2a4f", "#4a2a2a", "#2a3a4a", "#3a4a2a", "#4a3a2a"];
const EYES = ["round", "happy", "wink", "dot", "starry", "shades"];
const MOUTHS = ["smile", "grin", "smirk", "ooo", "neutral", "tongue"];
const HAIRSTYLES = ["short", "bun", "mohawk", "afro", "bald", "cap", "side"];
const ACCESSORIES = ["none", "none", "glasses", "headphones", "beauty-mark"];
function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function pickWith(arr, h, salt) {
    const mixed = ((h ^ Math.imul(salt, 2654435761)) >>> 0) % arr.length;
    return arr[mixed];
}
function looks(seed) {
    const h = hashString(seed);
    return {
        skin: pickWith(SKIN, h, 1),
        hair: pickWith(HAIR, h, 2),
        shirt: pickWith(SHIRT, h, 3),
        bg: pickWith(BG, h, 4),
        eyes: pickWith(EYES, h, 5),
        mouth: pickWith(MOUTHS, h, 6),
        hairStyle: pickWith(HAIRSTYLES, h, 7),
        accessory: pickWith(ACCESSORIES, h, 8),
        blush: (h & 1) === 1,
    };
}
function Eyes({ kind, color }) {
    if (kind === "happy")
        return (_jsxs("g", { fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round", children: [_jsx("path", { d: "M34 52 Q 40 46 46 52" }), _jsx("path", { d: "M54 52 Q 60 46 66 52" })] }));
    if (kind === "wink")
        return (_jsxs("g", { children: [_jsx("circle", { cx: "40", cy: "52", r: "4", fill: STROKE }), _jsx("path", { d: "M54 52 Q 60 46 66 52", fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" })] }));
    if (kind === "dot")
        return (_jsxs("g", { fill: STROKE, children: [_jsx("circle", { cx: "40", cy: "52", r: "3" }), _jsx("circle", { cx: "60", cy: "52", r: "3" })] }));
    if (kind === "starry")
        return (_jsxs("g", { fill: color, stroke: STROKE, strokeWidth: "2", children: [_jsx("path", { d: "M40 46 L 42 52 L 47 53 L 42 55 L 40 60 L 38 55 L 33 53 L 38 52 Z" }), _jsx("path", { d: "M60 46 L 62 52 L 67 53 L 62 55 L 60 60 L 58 55 L 53 53 L 58 52 Z" })] }));
    if (kind === "shades")
        return (_jsxs("g", { children: [_jsx("rect", { x: "30", y: "46", width: "18", height: "12", rx: "3", fill: STROKE }), _jsx("rect", { x: "52", y: "46", width: "18", height: "12", rx: "3", fill: STROKE }), _jsx("path", { d: "M48 52 L 52 52", stroke: STROKE, strokeWidth: "3" })] }));
    // round
    return (_jsxs("g", { children: [_jsx("circle", { cx: "40", cy: "52", r: "5", fill: "white", stroke: STROKE, strokeWidth: "2.5" }), _jsx("circle", { cx: "60", cy: "52", r: "5", fill: "white", stroke: STROKE, strokeWidth: "2.5" }), _jsx("circle", { cx: "41", cy: "53", r: "2", fill: STROKE }), _jsx("circle", { cx: "61", cy: "53", r: "2", fill: STROKE })] }));
}
function Mouth({ kind }) {
    if (kind === "grin")
        return _jsx("path", { d: "M38 70 Q 50 80 62 70 L 38 70 Z", fill: "white", stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" });
    if (kind === "smirk")
        return _jsx("path", { d: "M40 72 Q 52 76 60 70", fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" });
    if (kind === "ooo")
        return _jsx("ellipse", { cx: "50", cy: "72", rx: "5", ry: "6", fill: "#7a2a2a", stroke: STROKE, strokeWidth: "2.5" });
    if (kind === "neutral")
        return _jsx("path", { d: "M40 72 L 60 72", fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" });
    if (kind === "tongue")
        return (_jsxs("g", { children: [_jsx("path", { d: "M38 70 Q 50 80 62 70", fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" }), _jsx("ellipse", { cx: "54", cy: "76", rx: "4", ry: "3", fill: "#e26a8a", stroke: STROKE, strokeWidth: "2" })] }));
    // smile
    return _jsx("path", { d: "M38 68 Q 50 78 62 68", fill: "none", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" });
}
function Hair({ kind, color }) {
    if (kind === "bald")
        return null;
    if (kind === "cap")
        return (_jsxs("g", { children: [_jsx("path", { d: "M22 36 Q 50 14 78 36 L 78 42 L 22 42 Z", fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("circle", { cx: "50", cy: "22", r: "3", fill: "white", stroke: STROKE, strokeWidth: "2" })] }));
    if (kind === "bun")
        return (_jsxs("g", { fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round", children: [_jsx("circle", { cx: "50", cy: "18", r: "10" }), _jsx("path", { d: "M22 40 Q 28 24 50 24 Q 72 24 78 40 L 78 46 L 22 46 Z" })] }));
    if (kind === "mohawk")
        return (_jsx("path", { d: "M44 12 L 56 12 L 60 38 L 40 38 Z", fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }));
    if (kind === "afro")
        return (_jsx("g", { fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round", children: _jsx("circle", { cx: "50", cy: "28", r: "26" }) }));
    if (kind === "side")
        return (_jsx("path", { d: "M18 44 Q 22 22 50 20 Q 78 22 82 44 L 78 44 Q 70 30 50 30 Q 38 30 30 38 L 26 50 Q 22 50 18 44 Z", fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }));
    // short
    return (_jsx("path", { d: "M22 42 Q 24 22 50 20 Q 76 22 78 42 L 70 38 Q 50 28 30 38 Z", fill: color, stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }));
}
function Accessory({ kind }) {
    if (kind === "glasses")
        return (_jsxs("g", { fill: "none", stroke: STROKE, strokeWidth: "3", children: [_jsx("circle", { cx: "40", cy: "52", r: "8" }), _jsx("circle", { cx: "60", cy: "52", r: "8" }), _jsx("path", { d: "M48 52 L 52 52" })] }));
    if (kind === "headphones")
        return (_jsxs("g", { stroke: STROKE, strokeWidth: "3", fill: "#2a2a2a", children: [_jsx("path", { d: "M22 50 Q 22 26 50 26 Q 78 26 78 50", fill: "none" }), _jsx("rect", { x: "14", y: "46", width: "12", height: "16", rx: "3" }), _jsx("rect", { x: "74", y: "46", width: "12", height: "16", rx: "3" })] }));
    if (kind === "beauty-mark")
        return _jsx("circle", { cx: "64", cy: "64", r: "2.5", fill: STROKE });
    return null;
}
export function Avatar({ seed, size = 40, ring, }) {
    const l = looks(seed);
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", "aria-hidden": true, style: { display: "block", borderRadius: "50%", boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }, children: [_jsx("circle", { cx: "50", cy: "50", r: "50", fill: l.bg }), _jsx("path", { d: "M10 100 Q 18 78 50 78 Q 82 78 90 100 Z", fill: l.shirt, stroke: STROKE, strokeWidth: "3" }), _jsx("rect", { x: "44", y: "68", width: "12", height: "14", fill: l.skin, stroke: STROKE, strokeWidth: "2.5" }), _jsx("ellipse", { cx: "50", cy: "48", rx: "26", ry: "28", fill: l.skin, stroke: STROKE, strokeWidth: "3" }), _jsx("ellipse", { cx: "24", cy: "52", rx: "4", ry: "6", fill: l.skin, stroke: STROKE, strokeWidth: "2.5" }), _jsx("ellipse", { cx: "76", cy: "52", rx: "4", ry: "6", fill: l.skin, stroke: STROKE, strokeWidth: "2.5" }), _jsx(Hair, { kind: l.hairStyle, color: l.hair }), l.blush && (_jsxs("g", { fill: "#e26a8a", opacity: 0.55, children: [_jsx("ellipse", { cx: "32", cy: "62", rx: "5", ry: "3" }), _jsx("ellipse", { cx: "68", cy: "62", rx: "5", ry: "3" })] })), _jsx(Eyes, { kind: l.eyes, color: l.hair }), _jsx(Mouth, { kind: l.mouth }), _jsx(Accessory, { kind: l.accessory })] }));
}
