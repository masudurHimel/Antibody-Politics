import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { CardFront } from "../cards/CardFront";
const statusClass = {
    free: "",
    vaccinated: "status-vaccinated",
    infected: "status-infected",
    immunized: "status-immunized",
};
const statusLabel = {
    free: "",
    vaccinated: "VACCINATED",
    infected: "INFECTED",
    immunized: "IMMUNIZED",
};
export function OrganRow({ organs, onOrganClick, targetableIds, size = "clamp(80px, 14vh, 130px)", attachSize, gap = 8, }) {
    const attach = attachSize ?? `calc(${size} * 0.55)`;
    const slots = [
        ...organs,
        ...Array(Math.max(0, 4 - organs.length)).fill(null),
    ].slice(0, 4);
    return (_jsx("div", { className: "flex justify-center items-end", style: { height: `calc(${size} + 14px)`, gap: `${gap}px` }, children: slots.map((o, i) => {
            if (!o) {
                return (_jsx("div", { className: "slot-empty", style: { height: size, aspectRatio: "2 / 3" }, "aria-label": "empty organ slot" }, `empty-${i}`));
            }
            const tgt = targetableIds?.has(o.id);
            return (_jsxs(motion.button, { layout: true, whileHover: tgt ? { scale: 1.03, y: -2 } : undefined, onClick: () => onOrganClick?.(o), disabled: !tgt, className: `relative ${tgt ? "slot-target cursor-pointer" : "cursor-default"} disabled:cursor-default`, style: { height: size, borderRadius: 12 }, "aria-label": `${o.color} organ: ${o.status}`, children: [_jsx("div", { className: `relative rounded-[12px] ${statusClass[o.status]}`, children: _jsx(CardFront, { card: { id: o.id, type: "organ", color: o.color }, h: size }) }), o.status !== "free" && (_jsx("div", { className: "absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-chunky font-black text-[9px] tracking-wider", style: {
                            background: o.status === "infected"
                                ? "var(--c-red)"
                                : o.status === "vaccinated"
                                    ? "var(--c-green)"
                                    : "var(--c-yellow)",
                            color: "white",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                        }, children: statusLabel[o.status] })), o.attached.length > 0 && (_jsx("div", { className: "absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1", children: o.attached.map((a) => (_jsx(motion.div, { layoutId: a.id, layout: true, style: { transformOrigin: "bottom center" }, children: _jsx(CardFront, { card: a, h: attach }) }, a.id))) }))] }, o.id));
        }) }));
}
