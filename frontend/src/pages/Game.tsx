import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../game/store";
import { discardCards, passTurn, playCard } from "../game/actions";
import { BoardSeat } from "../components/BoardSeat";
import { Hand } from "../components/Hand";
import { OrganRow } from "../components/OrganRow";
import { ActivityLog } from "../components/ActivityLog";
import { ThemeToggle } from "../components/ThemeToggle";
import { Settings } from "../components/Settings";
import { Toast } from "../components/Toast";
import { Banner } from "../components/Banner";
import { Avatar } from "../components/Avatar";
import { CardBack } from "../cards/CardBack";
import { CardFront } from "../cards/CardFront";
import type { Card, Organ } from "../game/types";

function findCard(hand: Card[] | null, id: string | null): Card | null {
  if (!hand || !id) return null;
  return hand.find((c) => c.id === id) ?? null;
}

function isNoTargetCard(card: Card): boolean {
  if (card.type === "treatment" && (card.treatment_kind === "latex_glove" || card.treatment_kind === "contagion"))
    return true;
  return card.type === "organ";
}

function needsOrganTarget(card: Card): boolean {
  if (card.type === "virus" || card.type === "medicine") return true;
  if (card.type === "treatment" && (card.treatment_kind === "organ_thief" || card.treatment_kind === "transplant"))
    return true;
  return false;
}

function needsPlayerTarget(card: Card): boolean {
  return card.type === "treatment" && card.treatment_kind === "medical_error";
}

export default function Game() {
  const snap = useStore((s) => s.snapshot);
  const selection = useStore((s) => s.selection);
  const [pendingFromOrgan, setPendingFromOrgan] = useState<{ player: number; organ_id: string } | null>(null);

  if (!snap) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-text">
        <div className="font-chunky text-2xl">DEALING…</div>
      </div>
    );
  }

  const human = snap.players[0];
  const myTurn = snap.turn_idx === 0;
  const gameOver = snap.winner_idx !== null;
  const singleId = selection.length === 1 ? selection[0] : null;
  const singleCard = findCard(human.hand, singleId);

  // Auto-pass when it's our turn but our hand is empty (e.g. a bot just played Latex Glove).
  // Server only legalises pass with an empty hand, so this is the only valid move.
  const autoPassedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!myTurn || gameOver) return;
    const handLen = human.hand?.length ?? 0;
    if (handLen > 0) return;
    const key = `${snap.game_id}:${snap.turn_idx}:${snap.discard_count}`;
    if (autoPassedFor.current === key) return;
    autoPassedFor.current = key;
    passTurn();
  }, [myTurn, gameOver, human.hand, snap.game_id, snap.turn_idx, snap.discard_count]);

  function handleOrganClick(organ: Organ, ownerIdx: number) {
    if (!singleCard) return;
    if (singleCard.type === "treatment" && singleCard.treatment_kind === "transplant") {
      if (!pendingFromOrgan) {
        setPendingFromOrgan({ player: ownerIdx, organ_id: organ.id });
        return;
      }
      playCard(singleCard.id, { from: pendingFromOrgan, to: { player: ownerIdx, organ_id: organ.id } });
      setPendingFromOrgan(null);
      return;
    }
    if (needsOrganTarget(singleCard)) {
      playCard(singleCard.id, { player: ownerIdx, organ_id: organ.id });
      return;
    }
  }

  function handlePlayerClick(playerIdx: number) {
    if (!singleCard) return;
    if (needsPlayerTarget(singleCard)) {
      playCard(singleCard.id, { player: playerIdx });
    }
  }

  function handlePlay() {
    if (!singleCard) return;
    if (isNoTargetCard(singleCard)) {
      playCard(singleCard.id, {});
    }
  }

  function handleDiscard() {
    if (selection.length >= 1) {
      discardCards(selection);
    }
  }

  const targetable = useMemo(() => {
    if (!singleCard) return undefined;
    if (needsOrganTarget(singleCard)) {
      const all: Record<number, Set<string>> = {};
      for (const p of snap.players)
        all[p.idx] = new Set(p.body.filter((o) => o.status !== "immunized").map((o) => o.id));
      return all;
    }
    return undefined;
  }, [singleCard, snap]);

  const selPlayerTargetable = singleCard ? needsPlayerTarget(singleCard) : false;

  const playEnabled = myTurn && !gameOver && !!singleCard && isNoTargetCard(singleCard);
  const discardEnabled = myTurn && !gameOver && selection.length >= 1;

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg text-text">
      <div className="h-full w-full grid grid-cols-[1fr_280px] gap-3 p-3">
        {/* Table */}
        <div className="relative scene-3d">
          <div className="felt h-full w-full p-3 flex flex-col relative">

            {/* turn pill — top-center floating */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full font-chunky text-[10px] tracking-widest"
              style={{
                top: 8,
                background: myTurn ? "var(--accent)" : "rgba(0,0,0,0.5)",
                color: myTurn ? "var(--bg)" : "white",
                boxShadow: myTurn ? "0 0 18px rgba(245,196,58,0.6)" : "none",
              }}
            >
              {myTurn ? "YOUR TURN" : `${snap.players[snap.turn_idx]?.name?.toUpperCase()}'S TURN`}
            </div>

            {/* Top bot (seat 2) */}
            <div className="flex justify-center items-start pt-6" style={{ height: "24%" }}>
              <BoardSeat
                player={snap.players[2]}
                align="center"
                onOrganClick={(o) => handleOrganClick(o, 2)}
                targetableIds={targetable?.[2]}
                selectablePlayer={selPlayerTargetable}
                onSelectPlayer={() => handlePlayerClick(2)}
              />
            </div>

            {/* Middle row */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center" style={{ height: "27%" }}>
              <div className="flex justify-start">
                <BoardSeat
                  player={snap.players[1]}
                  align="left"
                  onOrganClick={(o) => handleOrganClick(o, 1)}
                  targetableIds={targetable?.[1]}
                  selectablePlayer={selPlayerTargetable}
                  onSelectPlayer={() => handlePlayerClick(1)}
                />
              </div>

              <div
                className="flex items-center gap-4 px-4 py-2 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-center">
                  <CardBack h="clamp(70px, 12vh, 110px)" />
                  <div className="font-chunky text-[10px] mt-1 text-white/80 tracking-wider">DECK · {snap.deck_count}</div>
                </div>
                <div className="text-center">
                  {snap.discard_top ? (
                    <div style={{ transform: "rotate(-6deg)" }}>
                      <CardFront card={snap.discard_top} h="clamp(70px, 12vh, 110px)" />
                    </div>
                  ) : (
                    <div className="slot-empty" style={{ height: "clamp(70px, 12vh, 110px)", aspectRatio: "2/3" }} />
                  )}
                  <div className="font-chunky text-[10px] mt-1 text-white/80 tracking-wider">DISCARD · {snap.discard_count}</div>
                </div>
              </div>

              <div className="flex justify-end">
                <BoardSeat
                  player={snap.players[3]}
                  align="right"
                  onOrganClick={(o) => handleOrganClick(o, 3)}
                  targetableIds={targetable?.[3]}
                  selectablePlayer={selPlayerTargetable}
                  onSelectPlayer={() => handlePlayerClick(3)}
                />
              </div>
            </div>

            {/* Human organ row */}
            <div className="flex justify-center items-end" style={{ height: "13%" }}>
              <OrganRow
                organs={human.body}
                targetableIds={targetable?.[0]}
                onOrganClick={(o) => handleOrganClick(o, 0)}
                size="clamp(72px, 11.5vh, 110px)"
              />
            </div>

            {/* Hand zone — generous bottom padding so cards don't clip */}
            <div className="flex-1 min-h-0 flex items-end justify-center" style={{ paddingBottom: 16 }}>
              <Hand cards={human.hand ?? []} active={myTurn && !gameOver} />
            </div>

            {/* Floating action toolbar — bottom-right of felt */}
            <div
              className="absolute z-30 flex flex-col gap-2 items-stretch"
              style={{ right: 18, bottom: 18, width: 140 }}
            >
              <button
                onClick={handlePlay}
                disabled={!playEnabled}
                className="rounded-xl py-2.5 font-chunky text-sm tracking-widest disabled:opacity-25 transition shadow-card"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                PLAY
              </button>
              <button
                onClick={handleDiscard}
                disabled={!discardEnabled}
                className="rounded-xl py-2.5 font-chunky text-sm tracking-widest disabled:opacity-25 transition shadow-card"
                style={{ background: "var(--c-red)", color: "white" }}
              >
                DISCARD{selection.length > 0 ? ` ${selection.length}` : ""}
              </button>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <aside
          className="rounded-2xl p-3 flex flex-col gap-3 overflow-hidden"
          style={{ background: "var(--surface)", boxShadow: "0 10px 30px -8px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-chunky tracking-widest text-sm">VIRUS!</h2>
            <ThemeToggle />
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {snap.players.map((p) => {
              const distinct = new Set(
                p.body.filter((o) => o.status !== "infected").map((o) => o.color),
              ).size;
              return (
                <div
                  key={p.idx}
                  className={`rounded-md px-2 py-1 flex items-center gap-2 ${
                    snap.turn_idx === p.idx ? "ring-1 ring-accent" : ""
                  }`}
                  style={{ background: "rgba(0,0,0,0.15)" }}
                >
                  <Avatar seed={`${snap.game_id}:${p.idx}`} size={22} />
                  <span className="font-semibold flex-1 truncate">{p.name}</span>
                  <span className="font-chunky">{distinct}/4</span>
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="font-display text-xs uppercase tracking-widest text-muted mb-1">Activity</div>
            <div className="flex-1 min-h-0 overflow-hidden activity">
              <ActivityLog />
            </div>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted">How to play</summary>
            <div className="pt-2 space-y-1 text-text/90">
              <div>• Win: 4 healthy organs in distinct colours.</div>
              <div>• Tap a card to select (max 3).</div>
              <div>• 1 card → PLAY or click an organ target.</div>
              <div>• 1-3 cards → DISCARD; you draw the same number back.</div>
            </div>
          </details>

          <div className="border-t border-white/10 pt-2">
            <div className="font-display text-xs uppercase tracking-widest text-muted mb-1">Settings</div>
            <Settings />
          </div>

          <button
            onClick={() => location.reload()}
            className="rounded-full px-4 py-2 font-chunky text-sm tracking-wider"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            NEW GAME
          </button>
        </aside>
      </div>

      <Toast />
      <Banner />
    </div>
  );
}
