import { motion } from "framer-motion";
import { useState } from "react";
import type { Card } from "../game/types";
import { useStore } from "../game/store";
import { useIsMobile } from "../game/useMediaQuery";
import { CardFront } from "../cards/CardFront";

const HAND_H = "clamp(110px, 19vh, 175px)";
const LIFT_BUFFER = 40; // px room above the rest position to absorb hover + selection lift

export function Hand({ cards, active }: { cards: Card[]; active: boolean }) {
  const isMobile = useIsMobile();
  if (isMobile) return <HandMobile cards={cards} active={active} />;
  return <HandDesktop cards={cards} active={active} />;
}

function HandDesktop({ cards, active }: { cards: Card[]; active: boolean }) {
  const selection = useStore((s) => s.selection);
  const total = cards.length;

  function onCardClick(id: string) {
    if (!active) return;
    useStore.getState().toggleSelect(id);
  }

  return (
    <div
      className="relative w-full flex items-end justify-center"
      style={{ height: `calc(${HAND_H} + ${LIFT_BUFFER + 16}px)`, paddingBottom: 4 }}
    >
      <div
        className="relative flex items-end justify-center"
        style={{ height: `calc(${HAND_H} + ${LIFT_BUFFER}px)` }}
      >
        {cards.map((c, i) => (
          <HandCard
            key={c.id}
            card={c}
            index={i}
            total={total}
            active={active}
            selectionIndex={selection.indexOf(c.id)}
            onClick={() => onCardClick(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function HandCard({
  card,
  index,
  total,
  active,
  selectionIndex,
  onClick,
}: {
  card: Card;
  index: number;
  total: number;
  active: boolean;
  selectionIndex: number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const offset = index - (total - 1) / 2;
  const restRotate = offset * 7;
  const restY = Math.abs(offset) * 4;
  const isSelected = selectionIndex >= 0;
  const selectionLift = isSelected ? -28 : 0;
  const hoverLift = hover && active && !isSelected ? -10 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      disabled={!active}
      aria-pressed={isSelected}
      aria-label={`${card.color} ${card.type}${isSelected ? " (selected)" : ""}`}
      className="relative outline-none disabled:cursor-not-allowed disabled:opacity-90"
      style={{
        marginLeft: index === 0 ? 0 : `calc(${HAND_H} / -4.4)`,
        zIndex: isSelected ? 40 : hover ? 50 : index,
        background: "transparent",
        border: "none",
        padding: 0,
        paddingTop: LIFT_BUFFER,
        height: `calc(${HAND_H} + ${LIFT_BUFFER}px)`,
        cursor: active ? "pointer" : "default",
      }}
    >
      <motion.div
        initial={{ y: -100, opacity: 0, rotate: -10, scale: 0.9 }}
        animate={{
          y: restY + selectionLift + hoverLift,
          opacity: 1,
          rotate: restRotate,
          scale: 1,
        }}
        transition={{
          type: "spring",
          damping: 28,
          stiffness: 350,
          mass: 0.6,
          delay: hover || isSelected ? 0 : index * 0.05,
        }}
        style={{
          transformOrigin: "bottom center",
          borderRadius: 12,
          boxShadow: isSelected
            ? "0 0 0 3px var(--accent), 0 0 22px rgba(245,196,58,0.65)"
            : "none",
          pointerEvents: "none",
        }}
      >
        <CardFront card={card} h={HAND_H} />
        {isSelected && (
          <div
            className="absolute -top-2 -right-2 rounded-full flex items-center justify-center font-chunky font-black"
            style={{
              width: 22,
              height: 22,
              background: "var(--accent)",
              color: "var(--bg)",
              fontSize: 12,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            {selectionIndex + 1}
          </div>
        )}
      </motion.div>
    </button>
  );
}

const HAND_MOBILE_H = "clamp(110px, 22vh, 150px)";

function HandMobile({ cards, active }: { cards: Card[]; active: boolean }) {
  const selection = useStore((s) => s.selection);

  function onCardClick(id: string) {
    if (!active) return;
    useStore.getState().toggleSelect(id);
  }

  return (
    <div
      className="w-full flex items-end overflow-x-auto overflow-y-visible no-overscroll hide-scrollbar"
      style={{
        height: `calc(${HAND_MOBILE_H} + 28px)`,
        paddingTop: 18,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
        gap: 10,
        scrollSnapType: "x proximity",
        justifyContent: "safe center",
      }}
    >
      {cards.map((c, i) => {
        const selectionIndex = selection.indexOf(c.id);
        const isSelected = selectionIndex >= 0;
        return (
          <MobileHandCard
            key={c.id}
            card={c}
            index={i}
            active={active}
            isSelected={isSelected}
            selectionIndex={selectionIndex}
            onClick={() => onCardClick(c.id)}
          />
        );
      })}
    </div>
  );
}

function MobileHandCard({
  card,
  index,
  active,
  isSelected,
  selectionIndex,
  onClick,
}: {
  card: Card;
  index: number;
  active: boolean;
  isSelected: boolean;
  selectionIndex: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!active}
      aria-pressed={isSelected}
      aria-label={`${card.color} ${card.type}${isSelected ? " (selected)" : ""}`}
      className="relative outline-none flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        scrollSnapAlign: "center",
        borderRadius: 12,
      }}
      initial={{ y: 30, opacity: 0, scale: 0.85 }}
      animate={{
        y: isSelected ? -14 : 0,
        opacity: 1,
        scale: isSelected ? 1.12 : 1,
      }}
      transition={{
        type: "spring",
        damping: 22,
        stiffness: 320,
        mass: 0.5,
        delay: index * 0.03,
      }}
      whileTap={{ scale: isSelected ? 1.05 : 0.96 }}
    >
      <div
        style={{
          borderRadius: 12,
          boxShadow: isSelected
            ? "0 0 0 3px var(--accent), 0 0 24px rgba(245,196,58,0.7), 0 6px 14px rgba(0,0,0,0.4)"
            : "0 4px 10px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <CardFront card={card} h={HAND_MOBILE_H} />
        {isSelected && (
          <div
            className="absolute -top-2 -right-2 rounded-full flex items-center justify-center font-chunky font-black"
            style={{
              width: 22,
              height: 22,
              background: "var(--accent)",
              color: "var(--bg)",
              fontSize: 12,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            {selectionIndex + 1}
          </div>
        )}
      </div>
    </motion.button>
  );
}
