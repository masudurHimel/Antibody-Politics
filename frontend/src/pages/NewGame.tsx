import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../game/store";
import { connectWs } from "../game/ws";
import { useIsMobile } from "../game/useMediaQuery";
import { CardFront } from "../cards/CardFront";
import type { Card } from "../game/types";

const hero: Card[] = [
  { id: "h-organ", type: "organ", color: "red" },
  { id: "h-virus", type: "virus", color: "green" },
  { id: "h-medicine", type: "medicine", color: "blue" },
  { id: "h-treatment", type: "treatment", color: "multi", treatment_kind: "organ_thief" },
  { id: "h-organ2", type: "organ", color: "yellow" },
];

export default function NewGame({ onStart }: { onStart: (gameId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const isMobile = useIsMobile();
  const spreadOffset = isMobile ? 42 : 90;
  const cardH = isMobile ? "clamp(120px, 22vh, 180px)" : "clamp(170px, 30vh, 260px)";

  async function start() {
    setBusy(true);
    const r = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await r.json();
    useStore.getState().setSnapshot(body.snapshot);
    connectWs(body.game_id);
    onStart(body.game_id);
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden text-text"
      style={{
        background:
          "radial-gradient(ellipse at 50% 25%, #1f4d34 0%, #0c2618 55%, #050f0a 100%)",
      }}
    >
      {/* Floating background bokeh */}
      {Array.from({ length: 22 }).map((_, i) => {
        const colors = ["var(--c-red)", "var(--c-green)", "var(--c-blue)", "var(--c-yellow)", "var(--accent)"];
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18, y: [0, -12, 0] }}
            transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.15 }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 8 + (i % 6) * 6,
              height: 8 + (i % 6) * 6,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              background: colors[i % colors.length],
              filter: "blur(8px)",
            }}
          />
        );
      })}

      {/* Hero card spread */}
      <div
        className="absolute pointer-events-none"
        style={{ top: "18%", left: "50%", transform: "translateX(-50%)", perspective: 1800 }}
      >
        <div className="relative">
          {hero.map((c, i) => {
            const offset = i - (hero.length - 1) / 2;
            return (
              <div
                key={c.id}
                style={{
                  position: "absolute",
                  left: offset * spreadOffset,
                  transform: "translateX(-50%)",
                  zIndex: 10 - Math.abs(offset),
                }}
              >
                <motion.div
                  initial={{ y: -260, opacity: 0, rotate: offset * 4, scale: 0.7 }}
                  animate={{
                    y: Math.abs(offset) * 6,
                    opacity: 1,
                    rotate: offset * 9,
                    scale: 1,
                  }}
                  transition={{
                    delay: 0.2 + i * 0.12,
                    type: "spring",
                    damping: 14,
                    stiffness: 160,
                  }}
                  style={{
                    transformOrigin: "bottom center",
                    filter: `drop-shadow(0 ${10 + Math.abs(offset) * 4}px ${
                      14 + Math.abs(offset) * 6
                    }px rgba(0,0,0,0.55))`,
                  }}
                >
                  <CardFront card={c} h={cardH} />
                </motion.div>
              </div>
            );
          })}
          <motion.div
            animate={{ rotate: [0, 8, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute"
            style={{
              left: -200,
              top: -120,
              filter: "blur(40px)",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(245,196,58,0.25)",
            }}
          />
        </div>
      </div>

      {/* Title overlay */}
      <div
        className="absolute inset-x-0 flex justify-center pointer-events-none"
        style={{ top: "2%" }}
      >
        <motion.h1
          initial={{ scale: 0.6, opacity: 0, y: -50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
          className="font-chunky font-black tracking-widest text-center select-none"
          style={{
            fontSize: "clamp(48px, min(14vh, 16vw), 180px)",
            color: "var(--accent)",
            textShadow:
              "0 8px 0 var(--c-red-d), 0 18px 40px rgba(0,0,0,0.7), 0 0 60px rgba(245,196,58,0.4)",
            letterSpacing: "0.05em",
            lineHeight: 0.9,
            padding: "0 12px",
            whiteSpace: "nowrap",
          }}
        >
          VIRUS!
        </motion.h1>
      </div>

      {/* CTA */}
      <div className="absolute inset-x-0 flex flex-col items-center gap-4" style={{ bottom: "8%" }}>
        <motion.button
          onClick={start}
          disabled={busy}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 60px rgba(245,196,58,0.7)" }}
          whileTap={{ scale: 0.96 }}
          className="font-chunky text-xl tracking-[0.25em] rounded-full px-12 py-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, var(--accent) 0%, #d4a01b 100%)",
            color: "var(--bg)",
            boxShadow:
              "0 18px 40px -10px rgba(0,0,0,0.6), inset 0 -4px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.55)",
          }}
        >
          {busy ? "DEALING…" : "DEAL"}
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1.2 }}
          className="flex items-center gap-2 text-xs tracking-[0.3em] text-white/70 font-chunky"
        >
          <span>4</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>SEATS</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>68</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>CARDS</span>
        </motion.div>
      </div>
    </div>
  );
}
