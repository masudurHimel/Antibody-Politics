import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STROKE = "#1a1410";
const HI = "rgba(255,255,255,0.45)";
const colorHex = {
    red: "var(--c-red)",
    green: "var(--c-green)",
    blue: "var(--c-blue)",
    yellow: "var(--c-yellow)",
    multi: "url(#multi-grad)",
};
const colorDark = {
    red: "var(--c-red-d)",
    green: "var(--c-green-d)",
    blue: "var(--c-blue-d)",
    yellow: "var(--c-yellow-d)",
    multi: "var(--c-red-d)",
};
function Defs() {
    return (_jsxs("defs", { children: [_jsxs("linearGradient", { id: "multi-grad", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--c-red)" }), _jsx("stop", { offset: "33%", stopColor: "var(--c-yellow)" }), _jsx("stop", { offset: "66%", stopColor: "var(--c-green)" }), _jsx("stop", { offset: "100%", stopColor: "var(--c-blue)" })] }), _jsxs("radialGradient", { id: "shine", cx: "30%", cy: "20%", r: "60%", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(255,255,255,0.7)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(255,255,255,0)" })] })] }));
}
// Organ: cartoon body part icon depending on color (heart/lung/stomach/brain)
function OrganGlyph({ color }) {
    const fill = colorHex[color];
    const dark = colorDark[color];
    // Use distinct silhouette per color so each organ feels unique
    if (color === "red") {
        // Heart
        return (_jsxs("g", { children: [_jsx("path", { d: "M50 86 C 18 64, 8 42, 22 26 C 32 14, 46 18, 50 30 C 54 18, 68 14, 78 26 C 92 42, 82 64, 50 86 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5", strokeLinejoin: "round" }), _jsx("path", { d: "M30 38 C 30 48, 38 56, 46 60", fill: "none", stroke: HI, strokeWidth: "3", strokeLinecap: "round" })] }));
    }
    if (color === "green") {
        // Stomach
        return (_jsxs("g", { children: [_jsx("path", { d: "M28 30 C 24 22, 32 12, 44 14 L 60 16 C 76 18, 84 28, 80 44 L 76 64 C 72 80, 56 86, 42 80 C 28 74, 22 60, 26 48 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5", strokeLinejoin: "round" }), _jsx("path", { d: "M38 36 C 44 42, 52 42, 60 38", fill: "none", stroke: dark, strokeWidth: "3", strokeLinecap: "round" }), _jsx("path", { d: "M36 52 C 46 60, 58 60, 70 52", fill: "none", stroke: dark, strokeWidth: "3", strokeLinecap: "round" })] }));
    }
    if (color === "blue") {
        // Lungs (twin lobes)
        return (_jsxs("g", { children: [_jsx("path", { d: "M50 16 L 50 70", stroke: STROKE, strokeWidth: "3.5", strokeLinecap: "round" }), _jsx("path", { d: "M48 24 C 28 26, 18 44, 22 64 C 24 76, 38 82, 48 72 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5", strokeLinejoin: "round" }), _jsx("path", { d: "M52 24 C 72 26, 82 44, 78 64 C 76 76, 62 82, 52 72 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5", strokeLinejoin: "round" })] }));
    }
    if (color === "yellow") {
        // Brain
        return (_jsxs("g", { children: [_jsx("path", { d: "M30 28 C 24 18, 38 10, 50 14 C 62 10, 76 18, 70 28 C 82 32, 82 50, 70 54 C 72 70, 56 78, 50 70 C 44 78, 28 70, 30 54 C 18 50, 18 32, 30 28 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5", strokeLinejoin: "round" }), _jsx("path", { d: "M50 22 L 50 70", stroke: STROKE, strokeWidth: "3" }), _jsx("path", { d: "M38 28 C 42 38, 38 48, 42 58", fill: "none", stroke: dark, strokeWidth: "2.5" }), _jsx("path", { d: "M62 28 C 58 38, 62 48, 58 58", fill: "none", stroke: dark, strokeWidth: "2.5" })] }));
    }
    // multi-color organ — wildcard
    return (_jsxs("g", { children: [_jsx("circle", { cx: "50", cy: "48", r: "32", fill: fill, stroke: STROKE, strokeWidth: "3.5" }), _jsx("text", { x: "50", y: "58", textAnchor: "middle", fontSize: "34", fontWeight: "900", fill: STROKE, children: "\u2605" })] }));
}
// Virus: spiky germ
function VirusGlyph({ color }) {
    const fill = colorHex[color];
    const dark = colorDark[color];
    return (_jsxs("g", { children: [Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const x1 = 50 + Math.cos(a) * 26, y1 = 48 + Math.sin(a) * 26;
                const x2 = 50 + Math.cos(a) * 38, y2 = 48 + Math.sin(a) * 38;
                return (_jsxs("g", { children: [_jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: STROKE, strokeWidth: "4", strokeLinecap: "round" }), _jsx("circle", { cx: x2, cy: y2, r: "3.5", fill: dark, stroke: STROKE, strokeWidth: "2" })] }, i));
            }), _jsx("circle", { cx: "50", cy: "48", r: "26", fill: fill, stroke: STROKE, strokeWidth: "3.5" }), _jsx("circle", { cx: "42", cy: "42", r: "3", fill: STROKE }), _jsx("circle", { cx: "58", cy: "42", r: "3", fill: STROKE }), _jsx("path", { d: "M40 56 Q 50 50 60 56", fill: "none", stroke: STROKE, strokeWidth: "2.5", strokeLinecap: "round" }), _jsx("circle", { cx: "40", cy: "34", r: "6", fill: HI })] }));
}
// Medicine: pill capsule
function MedicineGlyph({ color }) {
    const fill = colorHex[color];
    return (_jsxs("g", { transform: "translate(50 48) rotate(-25)", children: [_jsx("rect", { x: "-30", y: "-14", width: "60", height: "28", rx: "14", fill: "#fbf6ec", stroke: STROKE, strokeWidth: "3.5" }), _jsx("path", { d: "M-30 -14 L 0 -14 L 0 14 L -30 14 Z", fill: fill, stroke: STROKE, strokeWidth: "3.5" }), _jsx("ellipse", { cx: "-18", cy: "-6", rx: "6", ry: "3", fill: HI }), _jsx("line", { x1: "0", y1: "-14", x2: "0", y2: "14", stroke: STROKE, strokeWidth: "3" })] }));
}
// Treatments — one distinct glyph each
function TransplantGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M30 60 L 50 30 L 70 60 Z", fill: "var(--c-blue)", stroke: STROKE, strokeWidth: "3" }), _jsx("path", { d: "M30 36 L 50 66 L 70 36 Z", fill: "var(--c-red)", stroke: STROKE, strokeWidth: "3", opacity: "0.85" }), _jsx("path", { d: "M22 48 L 38 48 L 38 44 L 46 50 L 38 56 L 38 52 L 22 52 Z", fill: "#fbf6ec", stroke: STROKE, strokeWidth: "2.5" }), _jsx("path", { d: "M78 48 L 62 48 L 62 44 L 54 50 L 62 56 L 62 52 L 78 52 Z", fill: "#fbf6ec", stroke: STROKE, strokeWidth: "2.5" })] }));
}
function OrganThiefGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M22 38 Q 50 22 78 38 Q 78 58 50 60 Q 22 58 22 38 Z", fill: "#1a1410", stroke: STROKE, strokeWidth: "3" }), _jsx("circle", { cx: "38", cy: "44", r: "6", fill: "#fbf6ec" }), _jsx("circle", { cx: "62", cy: "44", r: "6", fill: "#fbf6ec" }), _jsx("circle", { cx: "38", cy: "44", r: "2.5", fill: STROKE }), _jsx("circle", { cx: "62", cy: "44", r: "2.5", fill: STROKE }), _jsx("path", { d: "M30 68 L 50 80 L 70 68 L 64 76 L 50 84 L 36 76 Z", fill: "var(--c-yellow)", stroke: STROKE, strokeWidth: "2.5" })] }));
}
function ContagionGlyph() {
    return (_jsxs("g", { children: [[[30, 38], [62, 32], [44, 60], [70, 60]].map(([cx, cy], i) => (_jsxs("g", { children: [Array.from({ length: 6 }).map((_, k) => {
                        const a = (k / 6) * Math.PI * 2;
                        const x2 = cx + Math.cos(a) * 14, y2 = cy + Math.sin(a) * 14;
                        return _jsx("line", { x1: cx, y1: cy, x2: x2, y2: y2, stroke: STROKE, strokeWidth: "2.5", strokeLinecap: "round" }, k);
                    }), _jsx("circle", { cx: cx, cy: cy, r: "8", fill: "var(--c-red)", stroke: STROKE, strokeWidth: "2.5" })] }, i))), _jsx("path", { d: "M30 38 Q 46 28 62 32", fill: "none", stroke: STROKE, strokeWidth: "2", strokeDasharray: "3 3" }), _jsx("path", { d: "M62 32 Q 66 50 70 60", fill: "none", stroke: STROKE, strokeWidth: "2", strokeDasharray: "3 3" })] }));
}
function LatexGloveGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M36 18 C 32 22, 32 36, 32 42 L 26 44 L 24 60 C 22 70, 30 84, 44 84 L 60 84 C 72 84, 76 74, 76 66 L 74 50 C 74 44, 76 38, 76 30 C 76 22, 70 18, 64 22 L 60 32 L 58 22 C 56 16, 50 16, 50 22 L 50 32 L 46 22 C 44 16, 38 14, 36 18 Z", fill: "#a8e0ff", stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("path", { d: "M40 60 Q 50 66 60 60", fill: "none", stroke: STROKE, strokeWidth: "2" }), _jsx("ellipse", { cx: "44", cy: "40", rx: "5", ry: "10", fill: HI })] }));
}
function MedicalErrorGlyph() {
    // body swap / shuffle arrows
    return (_jsxs("g", { children: [_jsx("path", { d: "M22 36 L 42 36 L 42 28 L 56 40 L 42 52 L 42 44 L 22 44 Z", fill: "var(--c-red)", stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("path", { d: "M78 60 L 58 60 L 58 68 L 44 56 L 58 44 L 58 52 L 78 52 Z", fill: "var(--c-green)", stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round", opacity: "0" }), _jsx("path", { d: "M78 64 L 58 64 L 58 72 L 44 60 L 58 48 L 58 56 L 78 56 Z", fill: "var(--c-green)", stroke: STROKE, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("text", { x: "50", y: "86", textAnchor: "middle", fontSize: "11", fontWeight: "900", fill: STROKE, children: "SWAP" })] }));
}
function TreatmentGlyph({ kind }) {
    switch (kind) {
        case "transplant": return _jsx(TransplantGlyph, {});
        case "organ_thief": return _jsx(OrganThiefGlyph, {});
        case "contagion": return _jsx(ContagionGlyph, {});
        case "latex_glove": return _jsx(LatexGloveGlyph, {});
        case "medical_error": return _jsx(MedicalErrorGlyph, {});
    }
}
export function CardPictogram({ card, size }) {
    const sizing = size ? { width: size, height: size } : { width: "100%", height: "100%" };
    return (_jsxs("svg", { viewBox: "0 0 100 100", ...sizing, "aria-hidden": true, preserveAspectRatio: "xMidYMid meet", children: [_jsx(Defs, {}), card.type === "organ" && _jsx(OrganGlyph, { color: card.color }), card.type === "virus" && _jsx(VirusGlyph, { color: card.color }), card.type === "medicine" && _jsx(MedicineGlyph, { color: card.color }), card.type === "treatment" && card.treatment_kind && _jsx(TreatmentGlyph, { kind: card.treatment_kind })] }));
}
// Card type label
export function cardLabel(card) {
    if (card.type === "treatment") {
        const map = {
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
export function cardCorner(card) {
    if (card.type === "organ")
        return "O";
    if (card.type === "virus")
        return "V";
    if (card.type === "medicine")
        return "M";
    return "T";
}
