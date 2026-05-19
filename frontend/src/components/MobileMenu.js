import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore } from "../game/store";
import { Avatar } from "./Avatar";
import { ActivityLog } from "./ActivityLog";
import { Settings } from "./Settings";
import { ThemeToggle } from "./ThemeToggle";
export function MobileMenu({ open, onClose }) {
    const snap = useStore((s) => s.snapshot);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    return (_jsx(AnimatePresence, { children: open && (_jsxs(_Fragment, { children: [_jsx(motion.div, { className: "fixed inset-0 z-40", style: { background: "rgba(0,0,0,0.55)" }, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 }, onClick: onClose, "aria-hidden": true }, "backdrop"), _jsxs(motion.div, { className: "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col safe-bottom", style: {
                        background: "var(--surface)",
                        maxHeight: "85vh",
                        boxShadow: "0 -10px 40px -6px rgba(0,0,0,0.6)",
                        color: "var(--text)",
                    }, initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring", damping: 32, stiffness: 360, mass: 0.8 }, role: "dialog", "aria-modal": "true", "aria-label": "Game menu", children: [_jsx("div", { className: "flex justify-center pt-2 pb-1", children: _jsx("div", { style: { width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)" } }) }), _jsxs("div", { className: "flex items-center justify-between px-4 pt-1 pb-2", children: [_jsx("h2", { className: "font-chunky tracking-widest text-base", children: "VIRUS!" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ThemeToggle, {}), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close menu", className: "rounded-full w-9 h-9 flex items-center justify-center", style: { background: "rgba(255,255,255,0.08)", color: "var(--text)" }, children: "\u2715" })] })] }), _jsxs("div", { className: "px-4 pb-3 overflow-y-auto flex-1 min-h-0 flex flex-col gap-3", children: [snap && (_jsx("div", { className: "grid grid-cols-2 gap-1.5 text-xs", children: snap.players.map((p) => {
                                        const distinct = new Set(p.body.filter((o) => o.status !== "infected").map((o) => o.color)).size;
                                        return (_jsxs("div", { className: `rounded-md px-2 py-1.5 flex items-center gap-2 ${snap.turn_idx === p.idx ? "ring-1 ring-accent" : ""}`, style: { background: "rgba(0,0,0,0.18)" }, children: [_jsx(Avatar, { seed: `${snap.game_id}:${p.idx}`, size: 24 }), _jsx("span", { className: "font-semibold flex-1 truncate", children: p.name }), _jsxs("span", { className: "font-chunky", children: [distinct, "/4"] })] }, p.idx));
                                    }) })), _jsxs("div", { className: "flex flex-col flex-1 min-h-0", children: [_jsx("div", { className: "font-display text-xs uppercase tracking-widest text-muted mb-1", children: "Activity" }), _jsx("div", { className: "activity overflow-y-auto no-overscroll", style: { maxHeight: "32vh" }, children: _jsx(ActivityLog, {}) })] }), _jsxs("details", { className: "text-sm", children: [_jsx("summary", { className: "cursor-pointer text-muted", children: "How to play" }), _jsxs("div", { className: "pt-2 space-y-1 text-text/90", children: [_jsx("div", { children: "\u2022 Win: 4 healthy organs in distinct colours." }), _jsx("div", { children: "\u2022 Tap a card to select (max 3)." }), _jsx("div", { children: "\u2022 1 card \u2192 PLAY or tap an organ target." }), _jsx("div", { children: "\u2022 1-3 cards \u2192 DISCARD; you draw the same number back." })] })] }), _jsxs("div", { className: "border-t border-white/10 pt-2", children: [_jsx("div", { className: "font-display text-xs uppercase tracking-widest text-muted mb-1", children: "Settings" }), _jsx(Settings, {})] }), _jsx("button", { type: "button", onClick: () => location.reload(), className: "rounded-full px-4 py-2.5 font-chunky text-sm tracking-wider mt-1", style: { background: "var(--accent)", color: "var(--bg)" }, children: "NEW GAME" })] })] }, "sheet")] })) }));
}
