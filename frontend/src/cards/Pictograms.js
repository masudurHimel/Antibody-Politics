import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const INK = "#1a120c";
const PAPER = "#f3ead7";
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
/* =========================================================================
   ORGANS — hand-drawn cartoon style with bold ink outline, matching the
   reference card designs in sources/card_design/.
   All glyphs draw on a 100×100 viewBox centered ~ (50,50).
   ========================================================================= */
function HeartOrgan() {
    // Red heart with stem/aorta at top, bold outline, soft highlight.
    const fill = colorHex.red;
    const dark = colorDark.red;
    return (_jsxs("g", { children: [_jsx("path", { d: "M46 20 C 44 14, 52 10, 54 16 L 54 28", fill: dark, stroke: INK, strokeWidth: "3.2", strokeLinejoin: "round", strokeLinecap: "round" }), _jsx("path", { d: "M50 86\n           C 16 64, 8 42, 22 28\n           C 32 18, 44 22, 50 32\n           C 56 22, 68 18, 78 28\n           C 92 42, 84 64, 50 86 Z", fill: fill, stroke: INK, strokeWidth: "3.6", strokeLinejoin: "round" }), _jsx("path", { d: "M30 38 C 30 50, 38 58, 44 62", fill: "none", stroke: "rgba(255,255,255,0.7)", strokeWidth: "3.5", strokeLinecap: "round" }), _jsx("ellipse", { cx: "34", cy: "36", rx: "4", ry: "6", fill: "rgba(255,255,255,0.55)" })] }));
}
function BrainOrgan() {
    // Blue brain — central seam + lobed folds.
    const fill = colorHex.blue;
    const dark = colorDark.blue;
    return (_jsxs("g", { stroke: INK, strokeWidth: "3.4", strokeLinejoin: "round", strokeLinecap: "round", children: [_jsx("path", { d: "M50 16\n           C 38 12, 26 18, 26 28\n           C 18 30, 14 40, 20 46\n           C 14 52, 18 62, 28 64\n           C 28 74, 40 80, 50 76\n           C 60 80, 72 74, 72 64\n           C 82 62, 86 52, 80 46\n           C 86 40, 82 30, 74 28\n           C 74 18, 62 12, 50 16 Z", fill: fill }), _jsx("path", { d: "M50 18 L 50 76", fill: "none" }), _jsx("path", { d: "M32 28 C 38 32, 36 38, 32 40", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("path", { d: "M28 44 C 36 46, 36 52, 30 56", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("path", { d: "M34 60 C 40 62, 42 68, 38 72", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("path", { d: "M68 28 C 62 32, 64 38, 68 40", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("path", { d: "M72 44 C 64 46, 64 52, 70 56", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("path", { d: "M66 60 C 60 62, 58 68, 62 72", fill: "none", stroke: dark, strokeWidth: "2.6" }), _jsx("ellipse", { cx: "36", cy: "26", rx: "5", ry: "3", fill: "rgba(255,255,255,0.6)", stroke: "none" })] }));
}
function StomachOrgan() {
    // Green stomach — J-shaped sack with esophagus stub and duodenum.
    const fill = colorHex.green;
    const dark = colorDark.green;
    return (_jsxs("g", { stroke: INK, strokeWidth: "3.4", strokeLinejoin: "round", strokeLinecap: "round", children: [_jsx("path", { d: "M44 14 L 44 24", fill: "none" }), _jsx("path", { d: "M44 22\n           C 30 22, 22 30, 24 44\n           C 22 56, 30 76, 50 80\n           C 64 82, 76 74, 76 62\n           C 76 56, 70 54, 64 56\n           C 60 58, 58 60, 58 50\n           C 60 38, 60 28, 50 22 Z", fill: fill }), _jsx("path", { d: "M70 60 C 76 62, 80 70, 76 76", fill: "none", strokeWidth: "3.4" }), _jsx("path", { d: "M34 36 C 40 40, 46 38, 50 34", fill: "none", stroke: dark, strokeWidth: "2.4" }), _jsx("path", { d: "M32 50 C 40 56, 50 56, 56 50", fill: "none", stroke: dark, strokeWidth: "2.4" }), _jsx("ellipse", { cx: "38", cy: "32", rx: "4", ry: "6", fill: "rgba(255,255,255,0.55)", stroke: "none" })] }));
}
function BoneOrgan() {
    // Yellow bone — classic dog-bone on a slight diagonal.
    return (_jsxs("g", { transform: "translate(50 50) rotate(-22)", stroke: INK, strokeWidth: "3.4", strokeLinejoin: "round", strokeLinecap: "round", children: [_jsx("circle", { cx: "-10", cy: "-30", r: "9", fill: "#fbf6e4" }), _jsx("circle", { cx: "10", cy: "-30", r: "9", fill: "#fbf6e4" }), _jsx("circle", { cx: "-10", cy: "30", r: "9", fill: "#fbf6e4" }), _jsx("circle", { cx: "10", cy: "30", r: "9", fill: "#fbf6e4" }), _jsx("rect", { x: "-9", y: "-26", width: "18", height: "52", fill: "#fbf6e4", stroke: "none" }), _jsx("path", { d: "M-10 -39\n           C -16 -39, -19 -36, -19 -30\n           C -19 -26, -17 -23, -13 -22\n           L -13 22\n           C -17 23, -19 26, -19 30\n           C -19 36, -16 39, -10 39\n           C -7 39, -4 37, -3 34\n           C -2 37, 1 39, 4 39\n           C 7 39, 10 37, 10 34\n           L 10 -34\n           C 10 -37, 7 -39, 4 -39\n           C 1 -39, -2 -37, -3 -34\n           C -4 -37, -7 -39, -10 -39 Z", fill: "none" }), _jsx("path", { d: "M-2 -22 L -2 22", fill: "none", stroke: "rgba(255,255,255,0.55)", strokeWidth: "3" })] }));
}
function MultiOrgan() {
    // Multi-color cartoon zombie — pale body, colored organs visible through
    // a transparent torso. Stylized to match the rainbow multi card reference.
    return (_jsxs("g", { stroke: INK, strokeWidth: "2.4", strokeLinejoin: "round", strokeLinecap: "round", children: [_jsx("ellipse", { cx: "50", cy: "22", rx: "11", ry: "12", fill: "#cdbac0" }), _jsx("path", { d: "M40 18 C 46 12, 54 12, 60 18 L 58 22 L 42 22 Z", fill: "#5b4a55", stroke: "none" }), _jsx("circle", { cx: "46", cy: "22", r: "1.6", fill: INK, stroke: "none" }), _jsx("circle", { cx: "54", cy: "22", r: "1.6", fill: INK, stroke: "none" }), _jsx("path", { d: "M44 20 L 49 22", fill: "none" }), _jsx("path", { d: "M51 22 L 56 20", fill: "none" }), _jsx("path", { d: "M44 28 L 46 30 L 48 28 L 50 30 L 52 28 L 54 30 L 56 28", fill: "none", strokeWidth: "1.6" }), _jsx("path", { d: "M46 34 L 46 38 L 54 38 L 54 34", fill: "#cdbac0" }), _jsx("path", { d: "M34 40\n           L 66 40\n           L 64 70\n           L 56 70\n           L 54 86\n           L 46 86\n           L 44 70\n           L 36 70 Z", fill: "#cdbac0" }), _jsx("path", { d: "M34 42 L 26 60 L 30 72", fill: "none" }), _jsx("path", { d: "M66 42 L 74 60 L 70 72", fill: "none" }), _jsx("circle", { cx: "30", cy: "72", r: "2.6", fill: "#cdbac0" }), _jsx("circle", { cx: "70", cy: "72", r: "2.6", fill: "#cdbac0" }), _jsx("path", { d: "M46 86 L 44 92", fill: "none" }), _jsx("path", { d: "M54 86 L 56 92", fill: "none" }), _jsx("circle", { cx: "44", cy: "93", r: "2.4", fill: "#cdbac0" }), _jsx("circle", { cx: "56", cy: "93", r: "2.4", fill: "#cdbac0" }), _jsx("path", { d: "M44 50\n           C 38 46, 38 42, 42 41\n           C 44 40.5, 45.5 42, 46 43\n           C 46.5 42, 48 40.5, 50 41\n           C 54 42, 54 46, 48 50\n           Z", fill: "var(--c-red)", strokeWidth: "1.8" }), _jsx("path", { d: "M54 56\n           C 48 56, 46 60, 50 64\n           C 54 67, 60 65, 59 60\n           C 59 57, 58 56, 54 56 Z", fill: "var(--c-green)", strokeWidth: "1.8" }), _jsx("line", { x1: "50", y1: "68", x2: "50", y2: "78", stroke: "#fbf6e4", strokeWidth: "2.8" }), _jsx("circle", { cx: "50", cy: "68", r: "1.8", fill: "#fbf6e4", stroke: INK, strokeWidth: "1.2" }), _jsx("circle", { cx: "50", cy: "78", r: "1.8", fill: "#fbf6e4", stroke: INK, strokeWidth: "1.2" })] }));
}
function OrganGlyph({ color }) {
    if (color === "red")
        return _jsx(HeartOrgan, {});
    if (color === "blue")
        return _jsx(BrainOrgan, {});
    if (color === "green")
        return _jsx(StomachOrgan, {});
    if (color === "yellow")
        return _jsx(BoneOrgan, {});
    return _jsx(MultiOrgan, {});
}
/* =========================================================================
   VIRUS / MEDICINE / TREATMENT — kept from the previous design, lightly
   updated so they read on the new paper-panel frame.
   ========================================================================= */
function VirusGlyph({ color }) {
    const fill = colorHex[color];
    const dark = colorDark[color];
    return (_jsxs("g", { children: [Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const x1 = 50 + Math.cos(a) * 26, y1 = 50 + Math.sin(a) * 26;
                const x2 = 50 + Math.cos(a) * 40, y2 = 50 + Math.sin(a) * 40;
                return (_jsxs("g", { children: [_jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: INK, strokeWidth: "4", strokeLinecap: "round" }), _jsx("circle", { cx: x2, cy: y2, r: "3.6", fill: dark, stroke: INK, strokeWidth: "2" })] }, i));
            }), _jsx("circle", { cx: "50", cy: "50", r: "26", fill: fill, stroke: INK, strokeWidth: "3.6" }), _jsx("circle", { cx: "42", cy: "44", r: "3", fill: INK }), _jsx("circle", { cx: "58", cy: "44", r: "3", fill: INK }), _jsx("path", { d: "M40 58 Q 50 52 60 58", fill: "none", stroke: INK, strokeWidth: "2.6", strokeLinecap: "round" }), _jsx("ellipse", { cx: "40", cy: "36", rx: "6", ry: "4", fill: "rgba(255,255,255,0.6)" })] }));
}
function MedicineGlyph({ color }) {
    const fill = colorHex[color];
    return (_jsxs("g", { transform: "translate(50 50) rotate(-25)", children: [_jsx("rect", { x: "-30", y: "-14", width: "60", height: "28", rx: "14", fill: PAPER, stroke: INK, strokeWidth: "3.6" }), _jsx("path", { d: "M-30 -14 L 0 -14 L 0 14 L -30 14 Z", fill: fill, stroke: INK, strokeWidth: "3.6" }), _jsx("ellipse", { cx: "-18", cy: "-6", rx: "6", ry: "3", fill: "rgba(255,255,255,0.6)" }), _jsx("line", { x1: "0", y1: "-14", x2: "0", y2: "14", stroke: INK, strokeWidth: "3" })] }));
}
function TransplantGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M30 60 L 50 30 L 70 60 Z", fill: "var(--c-blue)", stroke: INK, strokeWidth: "3" }), _jsx("path", { d: "M30 36 L 50 66 L 70 36 Z", fill: "var(--c-red)", stroke: INK, strokeWidth: "3", opacity: "0.85" }), _jsx("path", { d: "M22 50 L 38 50 L 38 46 L 46 52 L 38 58 L 38 54 L 22 54 Z", fill: PAPER, stroke: INK, strokeWidth: "2.5" }), _jsx("path", { d: "M78 50 L 62 50 L 62 46 L 54 52 L 62 58 L 62 54 L 78 54 Z", fill: PAPER, stroke: INK, strokeWidth: "2.5" })] }));
}
function OrganThiefGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M22 40 Q 50 24 78 40 Q 78 60 50 62 Q 22 60 22 40 Z", fill: INK, stroke: INK, strokeWidth: "3" }), _jsx("circle", { cx: "38", cy: "46", r: "6", fill: PAPER }), _jsx("circle", { cx: "62", cy: "46", r: "6", fill: PAPER }), _jsx("circle", { cx: "38", cy: "46", r: "2.5", fill: INK }), _jsx("circle", { cx: "62", cy: "46", r: "2.5", fill: INK }), _jsx("path", { d: "M30 70 L 50 82 L 70 70 L 64 78 L 50 86 L 36 78 Z", fill: "var(--c-yellow)", stroke: INK, strokeWidth: "2.5" })] }));
}
function ContagionGlyph() {
    return (_jsxs("g", { children: [[[30, 40], [62, 34], [44, 62], [70, 62]].map(([cx, cy], i) => (_jsxs("g", { children: [Array.from({ length: 6 }).map((_, k) => {
                        const a = (k / 6) * Math.PI * 2;
                        const x2 = cx + Math.cos(a) * 14, y2 = cy + Math.sin(a) * 14;
                        return _jsx("line", { x1: cx, y1: cy, x2: x2, y2: y2, stroke: INK, strokeWidth: "2.5", strokeLinecap: "round" }, k);
                    }), _jsx("circle", { cx: cx, cy: cy, r: "8", fill: "var(--c-red)", stroke: INK, strokeWidth: "2.5" })] }, i))), _jsx("path", { d: "M30 40 Q 46 30 62 34", fill: "none", stroke: INK, strokeWidth: "2", strokeDasharray: "3 3" }), _jsx("path", { d: "M62 34 Q 66 52 70 62", fill: "none", stroke: INK, strokeWidth: "2", strokeDasharray: "3 3" })] }));
}
function LatexGloveGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M36 20 C 32 24, 32 38, 32 44 L 26 46 L 24 62 C 22 72, 30 86, 44 86 L 60 86 C 72 86, 76 76, 76 68 L 74 52 C 74 46, 76 40, 76 32 C 76 24, 70 20, 64 24 L 60 34 L 58 24 C 56 18, 50 18, 50 24 L 50 34 L 46 24 C 44 18, 38 16, 36 20 Z", fill: "#a8e0ff", stroke: INK, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("path", { d: "M40 62 Q 50 68 60 62", fill: "none", stroke: INK, strokeWidth: "2" }), _jsx("ellipse", { cx: "44", cy: "42", rx: "5", ry: "10", fill: "rgba(255,255,255,0.55)" })] }));
}
function MedicalErrorGlyph() {
    return (_jsxs("g", { children: [_jsx("path", { d: "M22 38 L 42 38 L 42 30 L 56 42 L 42 54 L 42 46 L 22 46 Z", fill: "var(--c-red)", stroke: INK, strokeWidth: "3", strokeLinejoin: "round" }), _jsx("path", { d: "M78 66 L 58 66 L 58 74 L 44 62 L 58 50 L 58 58 L 78 58 Z", fill: "var(--c-green)", stroke: INK, strokeWidth: "3", strokeLinejoin: "round" })] }));
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
    return (_jsxs("svg", { viewBox: "0 0 100 100", ...sizing, "aria-hidden": true, preserveAspectRatio: "xMidYMid meet", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "multi-grad", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--c-red)" }), _jsx("stop", { offset: "33%", stopColor: "var(--c-yellow)" }), _jsx("stop", { offset: "66%", stopColor: "var(--c-green)" }), _jsx("stop", { offset: "100%", stopColor: "var(--c-blue)" })] }) }), card.type === "organ" && _jsx(OrganGlyph, { color: card.color }), card.type === "virus" && _jsx(VirusGlyph, { color: card.color }), card.type === "medicine" && _jsx(MedicineGlyph, { color: card.color }), card.type === "treatment" && card.treatment_kind && _jsx(TreatmentGlyph, { kind: card.treatment_kind })] }));
}
/* Number badge value — matches the canonical Virus! deck distribution. */
export function cardCount(card) {
    if (card.type === "organ")
        return card.color === "multi" ? 1 : 5;
    if (card.type === "virus")
        return card.color === "multi" ? 1 : 4;
    if (card.type === "medicine")
        return 4;
    // treatments
    const t = {
        transplant: 3,
        organ_thief: 1,
        contagion: 2,
        latex_glove: 1,
        medical_error: 3,
    };
    return card.treatment_kind ? t[card.treatment_kind] : 1;
}
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
