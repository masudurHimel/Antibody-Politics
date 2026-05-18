import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../game/store";

export function Banner() {
  const snap = useStore((s) => s.snapshot);
  const winner = snap?.winner_idx ?? null;
  return (
    <AnimatePresence>
      {winner !== null && snap && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          {Array.from({ length: 80 }).map((_, i) => {
            const angle = (i / 80) * Math.PI * 2;
            const dx = Math.cos(angle) * (160 + (i % 8) * 22);
            const dy = Math.sin(angle) * (160 + (i % 8) * 22);
            const colors = ["var(--c-red)", "var(--c-green)", "var(--c-blue)", "var(--c-yellow)", "var(--accent)"];
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{ x: dx, y: dy, opacity: 0, scale: 0.4, rotate: 720 }}
                transition={{ duration: 1.8, ease: "easeOut" }}
                className="absolute h-3 w-2 rounded-sm"
                style={{ background: colors[i % colors.length] }}
              />
            );
          })}
          <motion.div
            initial={{ scale: 0.5, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 180 }}
            className="rounded-3xl p-10 text-center"
            style={{
              background: "var(--surface)",
              border: "4px solid var(--accent)",
              boxShadow: "0 30px 60px -10px rgba(0,0,0,0.7)",
            }}
          >
            <div className="font-chunky tracking-widest text-accent text-lg mb-2">VIRUS!</div>
            <div className="font-chunky text-4xl mb-1">{snap.players[winner].name}</div>
            <div className="font-display text-muted mb-6">wins the round!</div>
            <button
              onClick={() => location.reload()}
              className="rounded-full px-6 py-2 font-chunky tracking-wider"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              PLAY AGAIN
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
