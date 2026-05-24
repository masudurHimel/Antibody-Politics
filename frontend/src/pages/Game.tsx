import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../game/store";
import { discardCards, passTurn, playCard } from "../game/actions";
import { useIsMobile } from "../game/useMediaQuery";
import { BoardSeat } from "../components/BoardSeat";
import { Hand } from "../components/Hand";
import { OrganRow } from "../components/OrganRow";
import { ActivityLog } from "../components/ActivityLog";
import { ThemeToggle } from "../components/ThemeToggle";
import { Settings } from "../components/Settings";
import { Toast } from "../components/Toast";
import { Banner } from "../components/Banner";
import { Avatar } from "../components/Avatar";
import { MobileMenu } from "../components/MobileMenu";
import { CardBack } from "../cards/CardBack";
import { CardFront } from "../cards/CardFront";
import { TurnTimer } from "../components/TurnTimer";
import { PauseOverlay } from "../components/PauseOverlay";
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
  const isMobile = useIsMobile();
  const [pendingFromOrgan, setPendingFromOrgan] = useState<{ player: number; organ_id: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const autoPassedFor = useRef<string | null>(null);

  const viewerIdx = snap?.viewer_idx ?? 0;
  const human = snap ? snap.players[viewerIdx] : null;
  const myTurn = !!snap && snap.turn_idx === viewerIdx;
  const gameOver = !!snap && snap.winner_idx !== null;
  const singleId = selection.length === 1 ? selection[0] : null;
  const singleCard = findCard(human?.hand ?? null, singleId);

  // Auto-pass when it's our turn but our hand is empty (e.g. a bot just played Latex Glove).
  // Server only legalises pass with an empty hand, so this is the only valid move.
  useEffect(() => {
    if (!snap || !human || !myTurn || gameOver) return;
    const handLen = human.hand?.length ?? 0;
    if (handLen > 0) return;
    const key = `${snap.game_id}:${snap.turn_idx}:${snap.discard_count}`;
    if (autoPassedFor.current === key) return;
    autoPassedFor.current = key;
    passTurn();
  }, [snap, human, myTurn, gameOver]);

  const targetable = useMemo(() => {
    if (!snap || !singleCard) return undefined;
    if (needsOrganTarget(singleCard)) {
      const all: Record<number, Set<string>> = {};
      const candidates = singleCard.type === "medicine"
        ? snap.players.filter((p) => p.idx === viewerIdx)
        : snap.players;
      for (const p of candidates)
        all[p.idx] = new Set(p.body.filter((o) => o.status !== "immunized").map((o) => o.id));
      return all;
    }
    return undefined;
  }, [singleCard, snap]);

  if (!snap || !human) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-text">
        <div className="font-chunky text-2xl">DEALING…</div>
      </div>
    );
  }

  // Map the three opponent slots to seats relative to the viewer.
  // Bottom = viewerIdx; left = +1; top = +2; right = +3 (mod 4).
  const seatLeft = (viewerIdx + 1) % snap.players.length;
  const seatTop = (viewerIdx + 2) % snap.players.length;
  const seatRight = (viewerIdx + 3) % snap.players.length;

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

  const selPlayerTargetable = singleCard ? needsPlayerTarget(singleCard) : false;

  const playEnabled = myTurn && !gameOver && !!singleCard && isNoTargetCard(singleCard);
  const discardEnabled = myTurn && !gameOver && selection.length >= 1;

  if (isMobile) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-bg text-text flex flex-col">
        {/* Top app bar */}
        <header
          className="flex items-center justify-between px-3 safe-top"
          style={{ height: 48, flexShrink: 0, background: "rgba(0,0,0,0.35)" }}
        >
          <h1 className="font-chunky tracking-widest text-sm">VIRUS!</h1>
          <div
            className="px-2.5 py-1 rounded-full font-chunky text-[10px] tracking-widest truncate"
            style={{
              maxWidth: "55%",
              background: myTurn ? "var(--accent)" : "rgba(0,0,0,0.5)",
              color: myTurn ? "var(--bg)" : "white",
              boxShadow: myTurn ? "0 0 14px rgba(245,196,58,0.55)" : "none",
            }}
          >
            {myTurn ? "YOUR TURN" : `${snap.players[snap.turn_idx]?.name?.toUpperCase()}'S TURN`}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-full flex items-center justify-center font-chunky"
            style={{
              width: 36,
              height: 36,
              background: "rgba(255,255,255,0.1)",
              color: "var(--text)",
              fontSize: 18,
            }}
          >
            ☰
          </button>
        </header>

        {/* Felt container */}
        <main className="flex-1 min-h-0 p-2 flex flex-col">
          <div className="felt flex-1 min-h-0 flex flex-col p-2 gap-2 overflow-hidden">
            {/* Opponent row (left, top, right relative to viewer) */}
            <div className="flex items-stretch gap-1.5" style={{ minHeight: "20vh" }}>
              {[seatLeft, seatTop, seatRight].map((seat) => (
                <BoardSeat
                  key={seat}
                  player={snap.players[seat]}
                  compact
                  onOrganClick={(o) => handleOrganClick(o, seat)}
                  targetableIds={targetable?.[seat]}
                  selectablePlayer={selPlayerTargetable}
                  onSelectPlayer={() => handlePlayerClick(seat)}
                />
              ))}
            </div>

            {/* Deck / discard band */}
            <div className="flex justify-center">
              <div
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-center">
                  <CardBack h="clamp(54px, 8vh, 72px)" />
                  <div className="font-chunky text-[9px] mt-0.5 text-white/80 tracking-wider">DECK · {snap.deck_count}</div>
                </div>
                <div className="text-center">
                  {snap.discard_top ? (
                    <div style={{ transform: "rotate(-5deg)" }}>
                      <CardFront card={snap.discard_top} h="clamp(54px, 8vh, 72px)" />
                    </div>
                  ) : (
                    <div className="slot-empty" style={{ height: "clamp(54px, 8vh, 72px)", aspectRatio: "2/3" }} />
                  )}
                  <div className="font-chunky text-[9px] mt-0.5 text-white/80 tracking-wider">DISCARD · {snap.discard_count}</div>
                </div>
              </div>
            </div>

            {/* Human organ row */}
            <div className="flex justify-center items-end pt-1">
              <OrganRow
                organs={human.body}
                targetableIds={targetable?.[viewerIdx]}
                onOrganClick={(o) => handleOrganClick(o, viewerIdx)}
                size="clamp(54px, 9vh, 78px)"
              />
            </div>

            {/* Hand strip */}
            <div className="flex-1 min-h-0 flex items-end justify-stretch">
              <Hand cards={human.hand ?? []} active={myTurn && !gameOver} />
            </div>
          </div>
        </main>

        {/* Action bar */}
        <div
          className="flex items-stretch gap-2 px-3 pt-2 safe-bottom"
          style={{ background: "rgba(0,0,0,0.35)", flexShrink: 0 }}
        >
          <button
            onClick={handlePlay}
            disabled={!playEnabled}
            className="flex-1 rounded-xl font-chunky text-base tracking-widest disabled:opacity-25 transition shadow-card"
            style={{ background: "var(--accent)", color: "var(--bg)", minHeight: 52 }}
          >
            PLAY
          </button>
          <button
            onClick={handleDiscard}
            disabled={!discardEnabled}
            className="flex-1 rounded-xl font-chunky text-base tracking-widest disabled:opacity-25 transition shadow-card"
            style={{ background: "var(--c-red)", color: "white", minHeight: 52 }}
          >
            DISCARD{selection.length > 0 ? ` ${selection.length}` : ""}
          </button>
        </div>

        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
        <Toast />
        <Banner />
      </div>
    );
  }

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

            {/* Top opponent (seat across from viewer) */}
            <div className="flex justify-center items-start pt-6" style={{ height: "24%" }}>
              <BoardSeat
                player={snap.players[seatTop]}
                align="center"
                onOrganClick={(o) => handleOrganClick(o, seatTop)}
                targetableIds={targetable?.[seatTop]}
                selectablePlayer={selPlayerTargetable}
                onSelectPlayer={() => handlePlayerClick(seatTop)}
              />
            </div>

            {/* Middle row */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center" style={{ height: "27%" }}>
              <div className="flex justify-start">
                <BoardSeat
                  player={snap.players[seatLeft]}
                  align="left"
                  onOrganClick={(o) => handleOrganClick(o, seatLeft)}
                  targetableIds={targetable?.[seatLeft]}
                  selectablePlayer={selPlayerTargetable}
                  onSelectPlayer={() => handlePlayerClick(seatLeft)}
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
                  player={snap.players[seatRight]}
                  align="right"
                  onOrganClick={(o) => handleOrganClick(o, seatRight)}
                  targetableIds={targetable?.[seatRight]}
                  selectablePlayer={selPlayerTargetable}
                  onSelectPlayer={() => handlePlayerClick(seatRight)}
                />
              </div>
            </div>

            {/* Human organ row */}
            <div className="flex justify-center items-end" style={{ height: "13%" }}>
              <OrganRow
                organs={human.body}
                targetableIds={targetable?.[viewerIdx]}
                onOrganClick={(o) => handleOrganClick(o, viewerIdx)}
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
      <MultiplayerHUD />
      <PauseOverlay />
    </div>
  );
}

function MultiplayerHUD() {
  const turnDeadline = useStore((s) => s.turnDeadline);
  const room = useStore((s) => s.room);
  if (!room || turnDeadline == null) return null;
  return (
    <div className="fixed top-3 right-3 z-40 px-3 py-2 rounded-full border border-white/20 bg-black/40 backdrop-blur">
      <TurnTimer deadlineMs={turnDeadline} />
    </div>
  );
}
