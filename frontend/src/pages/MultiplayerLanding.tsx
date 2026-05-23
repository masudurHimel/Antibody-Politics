import { useState } from "react";
import { motion } from "framer-motion";
import { createRoom, storeToken } from "../game/room";

export default function MultiplayerLanding({
  onCreated,
  onCancel,
}: {
  onCreated: (roomId: string, token: string, seat: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(localStorage.getItem("mp:lastName") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await createRoom(name.trim());
      storeToken(r.room_id, r.player_token);
      localStorage.setItem("mp:lastName", name.trim());
      onCreated(r.room_id, r.player_token, r.seat);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-screen w-screen text-text px-4"
      style={{
        background:
          "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)",
      }}
    >
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-chunky font-black text-4xl md:text-6xl mb-2"
        style={{ color: "var(--accent)" }}
      >
        CREATE ROOM
      </motion.h1>
      <p className="opacity-70 mb-8 tracking-widest text-sm">Pick a name. Invite friends.</p>
      <input
        autoFocus
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="px-4 py-3 rounded-lg text-black w-72 text-lg outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && name.trim()) submit();
        }}
      />
      {err && <p className="mt-3 text-red-400 text-sm">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="font-chunky text-sm tracking-[0.3em] px-6 py-3 rounded-full border border-white/30 text-white/90"
        >
          BACK
        </button>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={submit}
          disabled={busy || !name.trim()}
          className="font-chunky text-sm tracking-[0.3em] px-8 py-3 rounded-full disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, var(--accent) 0%, #d4a01b 100%)",
            color: "var(--bg)",
          }}
        >
          {busy ? "CREATING…" : "CREATE"}
        </motion.button>
      </div>
    </div>
  );
}
