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

const statusShort: Record<OrganStatus, string> = {
  free: "",
  vaccinated: "V",
  infected: "I",
  immunized: "★",
};

function statusColor(s: OrganStatus): string {
  if (s === "infected") return "var(--c-red)";
  if (s === "vaccinated") return "var(--c-green)";
  return "var(--c-yellow)";
}

export function OrganRow({
  organs,
  onOrganClick,
  targetableIds,
  pendingId,
  size = "clamp(80px, 14vh, 130px)",
  attachSize,
  gap = 8,
  compact = false,
}: {
  organs: Organ[];
  onOrganClick?: (organ: Organ) => void;
  targetableIds?: Set<string>;
  pendingId?: string | null;
  size?: string;
  attachSize?: string;
  gap?: number;
  compact?: boolean;
}) {
  const attach = attachSize ?? `calc(${size} * 0.55)`;
  const slots: (Organ | null)[] = [
    ...organs,
    ...Array<Organ | null>(Math.max(0, 4 - organs.length)).fill(null),
  ].slice(0, 4);
  const topBuffer = compact ? 6 : 14;

  return (
    <div className="flex justify-center items-end" style={{ height: `calc(${size} + ${topBuffer}px)`, gap: `${gap}px` }}>
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
        const isPending = !!pendingId && pendingId === o.id;
        return (
          <motion.button
            key={o.id}
            layout
            whileHover={tgt ? { scale: 1.03, y: -2 } : undefined}
            onClick={() => onOrganClick?.(o)}
            disabled={!tgt}
            className={`relative ${tgt ? "slot-target cursor-pointer" : "cursor-default"} disabled:cursor-default`}
            style={{
              height: size,
              borderRadius: 12,
              touchAction: "manipulation",
              boxShadow: isPending
                ? "0 0 0 3px var(--accent), 0 0 18px rgba(245,196,58,0.85)"
                : undefined,
              transform: isPending ? "translateY(-3px) scale(1.04)" : undefined,
              transition: "transform 160ms ease, box-shadow 160ms ease",
            }}
            aria-label={`${o.color} organ: ${o.status}${isPending ? " (selected as source)" : ""}`}
          >
            <div className={`relative rounded-[12px] ${statusClass[o.status]}`}>
              <CardFront card={{ id: o.id, type: "organ", color: o.color }} h={size} />
            </div>
            {o.status !== "free" && !compact && (
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-chunky font-black text-[9px] tracking-wider"
                style={{
                  background: statusColor(o.status),
                  color: "white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              >
                {statusLabel[o.status]}
              </div>
            )}
            {o.status !== "free" && compact && (
              <div
                className="absolute top-0.5 right-0.5 rounded-full font-chunky font-black flex items-center justify-center pointer-events-none"
                style={{
                  width: 14,
                  height: 14,
                  fontSize: 9,
                  lineHeight: 1,
                  background: statusColor(o.status),
                  color: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                }}
                aria-label={statusLabel[o.status]}
                title={statusLabel[o.status]}
              >
                {statusShort[o.status]}
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
