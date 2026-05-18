import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../game/store";
export function Banner() {
    const snap = useStore((s) => s.snapshot);
    const winner = snap?.winner_idx ?? null;
    return (_jsx(AnimatePresence, { children: winner !== null && snap && (_jsxs(motion.div, { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm", children: [Array.from({ length: 80 }).map((_, i) => {
                    const angle = (i / 80) * Math.PI * 2;
                    const dx = Math.cos(angle) * (160 + (i % 8) * 22);
                    const dy = Math.sin(angle) * (160 + (i % 8) * 22);
                    const colors = ["var(--c-red)", "var(--c-green)", "var(--c-blue)", "var(--c-yellow)", "var(--accent)"];
                    return (_jsx(motion.span, { initial: { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }, animate: { x: dx, y: dy, opacity: 0, scale: 0.4, rotate: 720 }, transition: { duration: 1.8, ease: "easeOut" }, className: "absolute h-3 w-2 rounded-sm", style: { background: colors[i % colors.length] } }, i));
                }), _jsxs(motion.div, { initial: { scale: 0.5, rotate: -8 }, animate: { scale: 1, rotate: 0 }, transition: { type: "spring", damping: 12, stiffness: 180 }, className: "rounded-3xl p-10 text-center", style: {
                        background: "var(--surface)",
                        border: "4px solid var(--accent)",
                        boxShadow: "0 30px 60px -10px rgba(0,0,0,0.7)",
                    }, children: [_jsx("div", { className: "font-chunky tracking-widest text-accent text-lg mb-2", children: "VIRUS!" }), _jsx("div", { className: "font-chunky text-4xl mb-1", children: snap.players[winner].name }), _jsx("div", { className: "font-display text-muted mb-6", children: "wins the round!" }), _jsx("button", { onClick: () => location.reload(), className: "rounded-full px-6 py-2 font-chunky tracking-wider", style: { background: "var(--accent)", color: "var(--bg)" }, children: "PLAY AGAIN" })] })] })) }));
}
