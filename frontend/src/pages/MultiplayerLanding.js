import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "framer-motion";
import { createRoom, storeToken } from "../game/room";
export default function MultiplayerLanding({ onCreated, onCancel, }) {
    const [name, setName] = useState(localStorage.getItem("mp:lastName") ?? "");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    async function submit() {
        setBusy(true);
        setErr(null);
        try {
            const r = await createRoom(name.trim());
            storeToken(r.room_id, r.player_token);
            localStorage.setItem("mp:lastName", name.trim());
            onCreated(r.room_id, r.player_token, r.seat);
        }
        catch (e) {
            setErr(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: "flex flex-col items-center justify-center h-screen w-screen text-text px-4", style: {
            background: "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)",
        }, children: [_jsx(motion.h1, { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, className: "font-chunky font-black text-4xl md:text-6xl mb-2", style: { color: "var(--accent)" }, children: "CREATE ROOM" }), _jsx("p", { className: "opacity-70 mb-8 tracking-widest text-sm", children: "Pick a name. Invite friends." }), _jsx("input", { autoFocus: true, placeholder: "Your name", value: name, onChange: (e) => setName(e.target.value), maxLength: 20, className: "px-4 py-3 rounded-lg text-black w-72 text-lg outline-none", onKeyDown: (e) => {
                    if (e.key === "Enter" && !busy && name.trim())
                        submit();
                } }), err && _jsx("p", { className: "mt-3 text-red-400 text-sm", children: err }), _jsxs("div", { className: "mt-6 flex gap-3", children: [_jsx("button", { onClick: onCancel, className: "font-chunky text-sm tracking-[0.3em] px-6 py-3 rounded-full border border-white/30 text-white/90", children: "BACK" }), _jsx(motion.button, { whileHover: { scale: 1.04 }, whileTap: { scale: 0.96 }, onClick: submit, disabled: busy || !name.trim(), className: "font-chunky text-sm tracking-[0.3em] px-8 py-3 rounded-full disabled:opacity-50", style: {
                            background: "linear-gradient(180deg, var(--accent) 0%, #d4a01b 100%)",
                            color: "var(--bg)",
                        }, children: busy ? "CREATING…" : "CREATE" })] })] }));
}
