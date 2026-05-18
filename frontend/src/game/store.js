import { create } from "zustand";
const initialTheme = (typeof localStorage !== "undefined" && localStorage.getItem("theme")) || "dark";
if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", initialTheme);
}
export const useStore = create((set, get) => ({
    conn: { status: "idle", ws: null },
    snapshot: null,
    gameId: null,
    events: [],
    selection: [],
    pendingTargets: null,
    theme: initialTheme,
    animSpeed: Number(localStorage.getItem("animSpeed") ?? "1"),
    soundOn: localStorage.getItem("soundOn") !== "0",
    botThinking: { player: null, since: 0 },
    toast: null,
    setSnapshot: (s) => set({ snapshot: s }),
    pushEvents: (e) => set((st) => ({ events: [...st.events, ...e].slice(-40) })),
    toggleSelect: (id) => set((st) => {
        if (st.selection.includes(id))
            return { selection: st.selection.filter((x) => x !== id) };
        if (st.selection.length >= 3)
            return st;
        return { selection: [...st.selection, id] };
    }),
    clearSelection: () => set({ selection: [], pendingTargets: null }),
    setPendingTargets: (t) => set({ pendingTargets: t }),
    setTheme: (t) => {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem("theme", t);
        set({ theme: t });
    },
    setBotThinking: (p) => set({ botThinking: { player: p, since: p == null ? 0 : performance.now() } }),
    setToast: (m) => set({ toast: m }),
    attach: (gameId, ws) => set({ gameId, conn: { status: "open", ws } }),
    send: (msg) => {
        const ws = get().conn.ws;
        if (ws && ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(msg));
    },
    applyServerEvent: (ev) => {
        if (ev.type === "snapshot") {
            set({ snapshot: ev.snapshot });
        }
        else if (ev.type === "action") {
            set((st) => ({
                snapshot: ev.snapshot,
                events: [...st.events, ...ev.events].slice(-40),
                botThinking: { player: null, since: 0 },
                selection: [],
                pendingTargets: null,
            }));
        }
        else if (ev.type === "bot_thinking") {
            set({ botThinking: { player: ev.player, since: performance.now() } });
        }
        else if (ev.type === "game_over") {
            set((st) => ({
                snapshot: ev.snapshot,
                events: [...st.events, `Winner: ${ev.snapshot.players[ev.winner_idx]?.name ?? "?"}`].slice(-40),
                toast: "Game over",
            }));
        }
        else if (ev.type === "error") {
            set({ toast: ev.message });
        }
    },
}));
