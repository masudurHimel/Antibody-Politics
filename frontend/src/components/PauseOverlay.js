import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "../game/store";
import { terminateRoom } from "../game/room";
export function PauseOverlay() {
    const isPaused = useStore((s) => s.isPaused);
    const waitingFor = useStore((s) => s.waitingFor);
    const room = useStore((s) => s.room);
    const mySeat = useStore((s) => s.mySeat);
    const token = useStore((s) => s.playerToken);
    const terminated = useStore((s) => s.terminated);
    if (!isPaused && !terminated)
        return null;
    const waitingNames = waitingFor
        .map((seat) => room?.players.find((p) => p.seat === seat)?.name)
        .filter(Boolean)
        .join(", ");
    const isHost = !!room?.players.find((p) => p.seat === mySeat)?.is_host;
    async function terminate() {
        if (!room || !token)
            return;
        try {
            await terminateRoom(room.id, token);
        }
        catch (e) {
            useStore.getState().setToast(e.message);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/70 grid place-items-center text-text p-6", children: _jsx("div", { className: "max-w-md w-full rounded-2xl p-8 text-center border", style: {
                background: "rgba(10,30,20,0.95)",
                borderColor: "rgba(255,255,255,0.10)",
            }, children: terminated ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "font-chunky font-black text-3xl mb-2", style: { color: "var(--accent)" }, children: "GAME TERMINATED" }), _jsx("p", { className: "opacity-70 text-sm", children: "The host ended this game." })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { className: "font-chunky font-black text-3xl mb-2", style: { color: "var(--accent)" }, children: "PAUSED" }), _jsxs("p", { className: "mb-6 text-sm", children: ["Waiting for ", _jsx("strong", { children: waitingNames || "player" }), " to reconnect\u2026"] }), isHost && (_jsx("button", { onClick: terminate, className: "font-chunky text-xs tracking-[0.3em] px-6 py-3 rounded-full border border-red-400/60 text-red-300", children: "TERMINATE GAME" }))] })) }) }));
}
