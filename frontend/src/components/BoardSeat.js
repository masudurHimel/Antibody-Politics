import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { CardBack } from "../cards/CardBack";
import { OrganRow } from "./OrganRow";
import { useStore } from "../game/store";
import { seatPulse } from "../anim/variants";
import { Avatar } from "./Avatar";
export function BoardSeat({ player, align = "center", onOrganClick, targetableIds, pendingId, selectablePlayer, onSelectPlayer, compact = false, }) {
    const thinkingPlayer = useStore((s) => s.botThinking.player);
    const isThinking = thinkingPlayer === player.idx;
    const turnIdx = useStore((s) => s.snapshot?.turn_idx);
    const gameId = useStore((s) => s.snapshot?.game_id ?? "");
    const isActive = turnIdx === player.idx;
    const avatarSeed = `${gameId}:${player.idx}`;
    if (compact) {
        return (_jsxs(motion.div, { variants: seatPulse, animate: isActive ? "active" : "idle", className: `flex flex-col items-center gap-1 rounded-xl px-1 py-1 flex-1 min-w-0 ${isActive ? "ring-2 ring-accent shadow-[0_0_18px_rgba(245,196,58,0.35)]" : ""} ${selectablePlayer ? "cursor-pointer hover:ring-2 hover:ring-accent2" : ""}`, style: {
                background: "rgba(0,0,0,0.22)",
                backdropFilter: "blur(2px)",
                border: "1px solid rgba(255,255,255,0.06)",
            }, children: [_jsxs("div", { className: "relative", onClick: selectablePlayer ? onSelectPlayer : undefined, style: { width: 36, height: 36, minWidth: 36, minHeight: 36 }, children: [_jsx("div", { className: `${isActive ? "turn-pulse" : ""}`, style: {
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                boxShadow: isActive
                                    ? "0 0 0 2px var(--accent), 0 2px 8px rgba(0,0,0,0.45)"
                                    : "0 2px 8px rgba(0,0,0,0.4)",
                                overflow: "hidden",
                            }, children: _jsx(Avatar, { seed: avatarSeed, size: "100%" }) }), _jsx("div", { className: "absolute -top-1 -right-1 rounded-full font-chunky flex items-center justify-center", style: {
                                minWidth: 16,
                                height: 16,
                                padding: "0 4px",
                                fontSize: 9,
                                background: "var(--accent)",
                                color: "var(--bg)",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
                            }, "aria-label": `${player.hand_count} cards in hand`, children: player.hand_count })] }), _jsx("div", { className: "font-display font-semibold truncate w-full text-center", style: { fontSize: 10, maxWidth: "10ch", lineHeight: 1.1 }, children: player.name }), isThinking && (_jsx(motion.div, { animate: { opacity: [0.3, 1, 0.3] }, transition: { repeat: Infinity, duration: 1.2 }, className: "text-muted", style: { fontSize: 8, lineHeight: 1, marginTop: -2 }, children: "thinking\u2026" })), _jsx("div", { className: "w-full flex justify-center", children: _jsx(OrganRow, { organs: player.body, size: "clamp(26px, 5.2vh, 36px)", onOrganClick: onOrganClick, targetableIds: targetableIds, pendingId: pendingId, gap: 4, compact: true }) })] }));
    }
    const organSize = "clamp(50px, 8.5vh, 80px)";
    const handBackH = "clamp(42px, 7.5vh, 72px)";
    return (_jsxs(motion.div, { variants: seatPulse, animate: isActive ? "active" : "idle", className: `flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 ${isActive ? "ring-2 ring-accent shadow-[0_0_30px_rgba(245,196,58,0.35)]" : ""} ${selectablePlayer ? "cursor-pointer hover:ring-2 hover:ring-accent2" : ""}`, onClick: selectablePlayer ? onSelectPlayer : undefined, style: {
            background: "rgba(0,0,0,0.18)",
            backdropFilter: "blur(2px)",
            border: "1px solid rgba(255,255,255,0.06)",
        }, children: [_jsxs("div", { className: "flex items-center gap-3 w-full justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `${isActive ? "turn-pulse" : ""}`, style: {
                                    width: "clamp(34px, 5.5vh, 48px)",
                                    height: "clamp(34px, 5.5vh, 48px)",
                                    borderRadius: "50%",
                                    boxShadow: isActive
                                        ? "0 0 0 2px var(--accent), 0 4px 10px rgba(0,0,0,0.45)"
                                        : "0 4px 10px rgba(0,0,0,0.4)",
                                    overflow: "hidden",
                                }, children: _jsx(Avatar, { seed: avatarSeed, size: "100%" }) }), _jsxs("div", { className: "leading-tight", children: [_jsx("div", { className: "font-display font-semibold", style: { fontSize: "clamp(12px, 1.8vh, 16px)" }, children: player.name }), _jsxs("div", { className: "text-muted", style: { fontSize: "clamp(9px, 1.4vh, 12px)" }, children: [player.hand_count, " cards", isThinking && _jsx(motion.span, { animate: { opacity: [0.3, 1, 0.3] }, transition: { repeat: Infinity, duration: 1.2 }, children: " \u2022 thinking\u2026" })] })] })] }), _jsx("div", { className: "flex", "aria-hidden": true, children: Array.from({ length: Math.min(player.hand_count, 5) }).map((_, i, arr) => {
                            const offset = i - (arr.length - 1) / 2;
                            return (_jsx("div", { style: {
                                    transform: `rotate(${offset * 6}deg) translateY(${Math.abs(offset) * 2}px)`,
                                    marginLeft: i === 0 ? 0 : `calc(${handBackH} / -3)`,
                                    transformOrigin: "bottom center",
                                }, children: _jsx(CardBack, { h: handBackH }) }, i));
                        }) })] }), _jsx("div", { className: `w-full flex ${align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center"}`, children: _jsx(OrganRow, { organs: player.body, size: organSize, onOrganClick: onOrganClick, targetableIds: targetableIds, pendingId: pendingId }) })] }));
}
