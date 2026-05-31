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
const statusShort = {
    free: "",
    vaccinated: "V",
    infected: "I",
    immunized: "★",
};
function statusColor(s) {
    if (s === "infected")
        return "var(--c-red)";
    if (s === "vaccinated")
        return "var(--c-green)";
    return "var(--c-yellow)";
}
export function OrganRow({ organs, onOrganClick, targetableIds, pendingId, size = "clamp(80px, 14vh, 130px)", attachSize, gap = 8, compact = false, }) {
    const attach = attachSize ?? `calc(${size} * 0.55)`;
    const slots = [
        ...organs,
        ...Array(Math.max(0, 4 - organs.length)).fill(null),
    ].slice(0, 4);
    const topBuffer = compact ? 6 : 14;
    return (_jsx("div", { className: "flex justify-center items-end", style: { height: `calc(${size} + ${topBuffer}px)`, gap: `${gap}px` }, children: slots.map((o, i) => {
            if (!o) {
                return (_jsx("div", { className: "slot-empty", style: { height: size, aspectRatio: "2 / 3" }, "aria-label": "empty organ slot" }, `empty-${i}`));
            }
            const tgt = targetableIds?.has(o.id);
            const isPending = !!pendingId && pendingId === o.id;
            return (_jsxs(motion.button, { layout: true, whileHover: tgt ? { scale: 1.03, y: -2 } : undefined, onClick: () => onOrganClick?.(o), disabled: !tgt, className: `relative ${tgt ? "slot-target cursor-pointer" : "cursor-default"} disabled:cursor-default`, style: {
                    height: size,
                    borderRadius: 12,
                    boxShadow: isPending
                        ? "0 0 0 3px var(--accent), 0 0 18px rgba(245,196,58,0.85)"
                        : undefined,
                    transform: isPending ? "translateY(-3px) scale(1.04)" : undefined,
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                }, "aria-label": `${o.color} organ: ${o.status}${isPending ? " (selected as source)" : ""}`, children: [_jsx("div", { className: `relative rounded-[12px] ${statusClass[o.status]}`, children: _jsx(CardFront, { card: { id: o.id, type: "organ", color: o.color }, h: size }) }), o.status !== "free" && !compact && (_jsx("div", { className: "absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-chunky font-black text-[9px] tracking-wider", style: {
                            background: statusColor(o.status),
                            color: "white",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                        }, children: statusLabel[o.status] })), o.status !== "free" && compact && (_jsx("div", { className: "absolute top-0.5 right-0.5 rounded-full font-chunky font-black flex items-center justify-center pointer-events-none", style: {
                            width: 14,
                            height: 14,
                            fontSize: 9,
                            lineHeight: 1,
                            background: statusColor(o.status),
                            color: "white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                        }, "aria-label": statusLabel[o.status], title: statusLabel[o.status], children: statusShort[o.status] })), o.attached.length > 0 && (_jsx("div", { className: "absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1", children: o.attached.map((a) => (_jsx(motion.div, { layoutId: a.id, layout: true, style: { transformOrigin: "bottom center" }, children: _jsx(CardFront, { card: a, h: attach }) }, a.id))) }))] }, o.id));
        }) }));
}
