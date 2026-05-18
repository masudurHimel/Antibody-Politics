import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CardPictogram, cardCorner, cardLabel } from "./Pictograms";
const colorClass = {
    red: "card-color-red",
    green: "card-color-green",
    blue: "card-color-blue",
    yellow: "card-color-yellow",
    multi: "card-color-multi",
};
/**
 * Card height drives everything else.
 * Width = height * 2/3 (poker card ratio).
 * Pass a CSS length string (px, vh, clamp(), etc.).
 */
export function CardFront({ card, h = "clamp(140px, 22vh, 200px)", }) {
    const isTreatment = card.type === "treatment";
    const bgClass = isTreatment ? "card-color-multi" : colorClass[card.color];
    return (_jsxs("div", { className: `relative overflow-hidden select-none card-face-3d backface-hidden ${bgClass}`, style: {
            height: h,
            aspectRatio: "2 / 3",
            borderRadius: "calc(var(--h) / 18)",
            // @ts-expect-error CSS var
            "--h": h,
            boxShadow: "0 calc(var(--h) / 18) calc(var(--h) / 6) calc(var(--h) / -18) rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.3), inset 0 0 0 2px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
        }, children: [_jsxs("div", { className: "absolute card-face flex flex-col items-center justify-between", style: {
                    inset: "6%",
                    borderRadius: "calc(var(--h) / 24)",
                    padding: "calc(var(--h) / 18) calc(var(--h) / 22)",
                }, children: [_jsx("div", { className: "absolute font-chunky font-black leading-none", style: {
                            left: "8%",
                            top: "4%",
                            fontSize: "calc(var(--h) / 12)",
                            color: "var(--card-ink)",
                        }, children: cardCorner(card) }), _jsx("div", { className: "absolute font-chunky font-black leading-none rotate-180", style: {
                            right: "8%",
                            bottom: "4%",
                            fontSize: "calc(var(--h) / 12)",
                            color: "var(--card-ink)",
                        }, children: cardCorner(card) }), _jsx("div", { className: "flex-1 flex items-center justify-center w-full", children: _jsx(PictogramScaled, { card: card, h: h }) }), _jsx("div", { className: "w-[90%] text-center font-chunky font-black uppercase", style: {
                            fontSize: "calc(var(--h) / 16)",
                            color: "var(--card-ink)",
                            letterSpacing: "0.06em",
                            lineHeight: 1,
                        }, children: cardLabel(card) })] }), _jsx("div", { className: "pointer-events-none absolute inset-0", style: {
                    background: "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)",
                } })] }));
}
function PictogramScaled({ card, h }) {
    return (_jsx("div", { style: {
            width: `calc(${h} * 0.5)`,
            height: `calc(${h} * 0.5)`,
        }, className: "flex items-center justify-center", children: _jsx(CardPictogram, { card: card }) }));
}
