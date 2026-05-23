import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../game/store";
import { Avatar } from "../components/Avatar";
import { setReady, startRoom } from "../game/room";
export default function Lobby({ roomId, token, onStarted, onLeave, }) {
    const room = useStore((s) => s.room);
    const mySeat = useStore((s) => s.mySeat);
    const toast = useStore((s) => s.toast);
    const [starting, setStarting] = useState(false);
    const [inviteBase, setInviteBase] = useState(location.origin);
    useEffect(() => {
        fetch("/api/host_url")
            .then((r) => (r.ok ? r.json() : null))
            .then((b) => {
            if (b?.public_url)
                setInviteBase(b.public_url);
        })
            .catch(() => { });
    }, []);
    const me = useMemo(() => room?.players.find((p) => p.seat === mySeat) ?? null, [room, mySeat]);
    const isHost = !!me?.is_host;
    const humans = room?.players.filter((p) => !p.is_bot) ?? [];
    const allReady = humans.length > 0 && humans.every((p) => p.ready);
    const inviteUrl = `${inviteBase.replace(/\/$/, "")}/join/${roomId}`;
    useEffect(() => {
        if (room?.status === "playing")
            onStarted();
    }, [room?.status, onStarted]);
    async function toggleReady() {
        if (!me)
            return;
        try {
            await setReady(roomId, token, !me.ready);
        }
        catch (e) {
            useStore.getState().setToast(e.message);
        }
    }
    async function start() {
        if (starting)
            return;
        setStarting(true);
        try {
            await startRoom(roomId, token);
        }
        catch (e) {
            setStarting(false);
            useStore.getState().setToast(e.message);
        }
    }
    async function copyInvite() {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            useStore.getState().setToast("Invite link copied");
            setTimeout(() => useStore.getState().setToast(null), 2000);
        }
        catch {
            useStore.getState().setToast(inviteUrl);
        }
    }
    if (!room) {
        return (_jsx("div", { className: "h-screen w-screen grid place-items-center text-text", style: {
                background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)",
            }, children: _jsx("div", { className: "font-chunky tracking-[0.4em] opacity-60", children: "CONNECTING\u2026" }) }));
    }
    return (_jsx("div", { className: "min-h-screen w-screen text-text", style: {
            background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)",
        }, children: _jsxs("div", { className: "max-w-2xl mx-auto pt-10 px-4 pb-16", children: [_jsxs(motion.h1, { initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, className: "font-chunky font-black text-4xl md:text-5xl mb-2", style: { color: "var(--accent)" }, children: ["ROOM ", room.id] }), _jsx("p", { className: "opacity-70 mb-8 text-sm", children: "Waiting for players\u2026 empty seats become bots when you start." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 mb-8", children: [0, 1, 2, 3].map((seat) => {
                        const p = room.players.find((x) => x.seat === seat);
                        return (_jsx(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: seat * 0.05 }, className: "rounded-xl p-4 flex items-center gap-3 border", style: {
                                background: "rgba(255,255,255,0.04)",
                                borderColor: "rgba(255,255,255,0.10)",
                            }, children: p ? (_jsxs(_Fragment, { children: [_jsx(Avatar, { seed: p.name, size: 48 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "font-chunky tracking-wider truncate", children: [p.name, " ", p.is_host && (_jsx("span", { style: { color: "var(--accent)" }, children: "\u2605" }))] }), _jsx("div", { className: "text-xs opacity-60 tracking-widest", children: p.is_bot
                                                    ? "BOT"
                                                    : p.ready
                                                        ? "READY"
                                                        : "WAITING" })] }), !p.is_bot && p.ready && (_jsx("div", { className: "w-2 h-2 rounded-full", style: { background: "#3aa15a" } }))] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-12 h-12 rounded-full border border-dashed border-white/20" }), _jsx("div", { className: "flex-1 italic opacity-50 text-sm", children: "Empty \u2014 will be filled by a bot" })] })) }, seat));
                    }) }), _jsxs("div", { className: "flex flex-wrap gap-3 justify-center", children: [_jsx("button", { onClick: copyInvite, className: "font-chunky text-xs tracking-[0.3em] px-5 py-3 rounded-full border border-white/30 text-white/90", children: "COPY INVITE" }), _jsx(motion.button, { whileTap: { scale: 0.96 }, onClick: toggleReady, className: "font-chunky text-xs tracking-[0.3em] px-6 py-3 rounded-full", style: me?.ready
                                ? {
                                    background: "rgba(255,255,255,0.15)",
                                    color: "var(--text)",
                                }
                                : {
                                    background: "linear-gradient(180deg, var(--accent) 0%, #d4a01b 100%)",
                                    color: "var(--bg)",
                                }, children: me?.ready ? "UNREADY" : "READY" }), isHost && (_jsx(motion.button, { whileTap: { scale: 0.96 }, onClick: start, disabled: !allReady || starting, className: "font-chunky text-xs tracking-[0.3em] px-8 py-3 rounded-full disabled:opacity-40", style: {
                                background: "linear-gradient(180deg, var(--accent) 0%, #d4a01b 100%)",
                                color: "var(--bg)",
                            }, children: starting ? "STARTING…" : "START" })), _jsx("button", { onClick: onLeave, className: "font-chunky text-xs tracking-[0.3em] px-5 py-3 rounded-full border border-white/30 text-white/90", children: "LEAVE" })] }), toast && (_jsx("div", { className: "mt-6 text-center text-sm opacity-80", children: toast }))] }) }));
}
