import { motion } from "framer-motion";
import type { Organ, OrganStatus } from "../game/types";
import { CardFront } from "../cards/CardFront";

const statusClass: Record<OrganStatus, string> = {
  free: "",
  vaccinated: "status-vaccinated",
  infected: "status-infected",
  immunized: "status-immunized",
};

const statusLabel: Record<OrganStatus, string> = {
  free: "",
  vaccinated: "VACCINATED",
  infected: "INFECTED",
  immunized: "IMMUNIZED",
};

export function OrganRow({
  organs,
  onOrganClick,
  targetableIds,
  size = "clamp(80px, 14vh, 130px)",
  attachSize,
}: {
  organs: Organ[];
  onOrganClick?: (organ: Organ) => void;
  targetableIds?: Set<string>;
  size?: string;
  attachSize?: string;
}) {
  const attach = attachSize ?? `calc(${size} * 0.55)`;
  const slots: (Organ | null)[] = [
    ...organs,
    ...Array<Organ | null>(Math.max(0, 4 - organs.length)).fill(null),
  ].slice(0, 4);

  return (
    <div className="flex gap-2 justify-center items-end" style={{ height: `calc(${size} + 14px)` }}>
      {slots.map((o, i) => {
        if (!o) {
          return (
            <div
              key={`empty-${i}`}
              className="slot-empty"
              style={{ height: size, aspectRatio: "2 / 3" }}
              aria-label="empty organ slot"
            />
          );
        }
        const tgt = targetableIds?.has(o.id);
        return (
          <motion.button
            key={o.id}
            layout
            whileHover={tgt ? { scale: 1.03, y: -2 } : undefined}
            onClick={() => onOrganClick?.(o)}
            disabled={!tgt}
            className={`relative ${tgt ? "slot-target cursor-pointer" : "cursor-default"} disabled:cursor-default`}
            style={{ height: size, borderRadius: 12 }}
            aria-label={`${o.color} organ: ${o.status}`}
          >
            <div className={`relative rounded-[12px] ${statusClass[o.status]}`}>
              <CardFront card={{ id: o.id, type: "organ", color: o.color }} h={size} />
            </div>
            {o.status !== "free" && (
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-chunky font-black text-[9px] tracking-wider"
                style={{
                  background:
                    o.status === "infected"
                      ? "var(--c-red)"
                      : o.status === "vaccinated"
                      ? "var(--c-green)"
                      : "var(--c-yellow)",
                  color: "white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              >
                {statusLabel[o.status]}
              </div>
            )}
            {o.attached.length > 0 && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {o.attached.map((a) => (
                  <motion.div key={a.id} layoutId={a.id} layout style={{ transformOrigin: "bottom center" }}>
                    <CardFront card={a} h={attach} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
