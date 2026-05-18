import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../game/store";

export function ActivityLog() {
  const snap = useStore((s) => s.snapshot);
  const events = snap?.event_log ?? [];
  const tail = events.slice(-25).reverse(); // newest first

  return (
    <div className="h-full overflow-y-auto activity pr-1 space-y-1">
      <AnimatePresence initial={false}>
        {tail.map((e, i) => (
          <motion.div
            key={`${events.length - 1 - i}-${e}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1 - Math.min(i * 0.05, 0.55), x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="text-[12px] leading-snug rounded px-2 py-1"
            style={{
              background: i === 0 ? "rgba(245,196,58,0.12)" : "rgba(255,255,255,0.03)",
              borderLeft: i === 0 ? "2px solid var(--accent)" : "2px solid transparent",
              color: "var(--text)",
            }}
          >
            {e}
          </motion.div>
        ))}
      </AnimatePresence>
      {tail.length === 0 && <div className="text-xs text-muted">No moves yet.</div>}
    </div>
  );
}
