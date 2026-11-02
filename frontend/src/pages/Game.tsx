import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../game/store";
import { discardCards, passTurn, playCard } from "../game/actions";
import {
  gameInProgress,
  resolveGhostClick,
  resolveOrganClick,
  resolvePlayerClick,
  targetView,
  type ClickResult,
} from "../game/selection";
import { moveTargets } from "../game/targets";
import { TableScene } from "../three/TableScene";
import type { Mode, OrganRef } from "../three/contract";
import { SidePanel } from "../components/SidePanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Toast } from "../components/Toast";
import { Banner } from "../components/Banner";
import { PauseOverlay } from "../components/PauseOverlay";

type Pending = { kind: "mode"; target: Mode } | { kind: "new" } | null;

export default function Game({
  onNewGame,
  onSwitchMode,
}: {
  /** start a fresh game in the current mode */
  onNewGame: () => void;
  /** leave this game and start one in the other mode */
  onSwitchMode: (mode: Mode) => void;
}) {
  const snap = useStore((s) => s.snapshot);
  const selection = useStore((s) => s.selection);
  const pendingOrgan = useStore((s) => s.pendingOrgan);
  const room = useStore((s) => s.room);
  const isPaused = useStore((s) => s.isPaused);
  const terminated = useStore((s) => s.terminated);
  const lastAction = useStore((s) => s.lastAction);
  const thinkingPlayer = useStore((s) => s.botThinking.player);
  const turnDeadline = useStore((s) => s.turnDeadline);
  const animSpeed = useStore((s) => s.animSpeed);
  const ws = useStore((s) => s.conn.ws);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [handTopFrac, setHandTopFrac] = useState(0.3);
  const autoPassedFor = useRef<string | null>(null);

  const mode: Mode = room ? "mp" : "solo";
  const me = snap?.viewer_idx ?? 0;
  const human = snap ? snap.players[me] : null;
  const myTurn = !!snap && snap.turn_idx === me;
  const gameOver = !!snap && snap.winner_idx !== null;
  const interactive = myTurn && !gameOver && !isPaused && !terminated;
  const singleCard =
    selection.length === 1 ? (human?.hand?.find((c) => c.id === selection[0]) ?? null) : null;

  const view = useMemo(
    () => (snap ? targetView(snap, me, singleCard, selection.length, pendingOrgan) : null),
    [snap, me, singleCard, selection.length, pendingOrgan],
  );

  // Auto-pass when it's our turn but our hand is empty (e.g. someone just played Latex Glove).
  // The server only legalises pass with an empty hand, so this is the only valid move.
  useEffect(() => {
    if (!snap || !human || !myTurn || gameOver) return;
    if ((human.hand?.length ?? 0) > 0) return;
    const key = `${snap.game_id}:${snap.turn_idx}:${snap.discard_count}`;
    if (autoPassedFor.current === key) return;
    autoPassedFor.current = key;
    passTurn();
  }, [snap, human, myTurn, gameOver]);

  // Tell the server the saved solo pace whenever a socket opens (it defaults to normal).
  useEffect(() => {
    const st = useStore.getState();
    if (ws && mode === "solo" && st.animSpeed !== 1) st.send({ type: "set_pace", factor: st.animSpeed });
  }, [ws, mode]);

  // Esc clears the selection (the confirm dialog swallows Esc while it is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useStore.getState().clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cancelConfirm = useCallback(() => setConfirm(null), []);

  function apply(r: ClickResult) {
    if (r.type === "play") playCard(r.cardId, r.targets);
    else if (r.type === "pending") useStore.getState().setPendingOrgan(r.pending);
  }

  function requestMode(target: Mode) {
    if (target === mode) return;
    if (gameInProgress(snap) && !terminated) setConfirm({ kind: "mode", target });
    else onSwitchMode(target);
  }

  function requestNewGame() {
    if (gameInProgress(snap) && !terminated) setConfirm({ kind: "new" });
    else onNewGame();
  }

  function confirmLeave() {
    const c = confirm;
    setConfirm(null);
    if (c?.kind === "mode") onSwitchMode(c.target);
    else if (c?.kind === "new") onNewGame();
  }

  const header = (
    <header className="top">
      <div className="brand">
        <h1>
          Antibody <span>Politics</span>
        </h1>
        <p>68-card Virus! deck · 3D table</p>
      </div>
      <div className="controls">
        <div className="seg" role="group" aria-label="Game mode">
          <button type="button" aria-pressed={mode === "solo"} onClick={() => requestMode("solo")}>
            Solo ward<small>you vs 3 bots</small>
          </button>
          <button type="button" aria-pressed={mode === "mp"} onClick={() => requestMode("mp")}>
            Multiplayer table<small>4 seats · online</small>
          </button>
        </div>
        <button type="button" className="ghost-btn" onClick={requestNewGame}>
          New game
        </button>
      </div>
    </header>
  );

  const dialog = confirm && (
    <ConfirmDialog
      title={
        confirm.kind === "new"
          ? "Start a new game?"
          : confirm.target === "mp"
            ? "Switch to Multiplayer?"
            : "Switch to Solo ward?"
      }
      text="Your current game will end and a new one will start."
      confirmLabel={confirm.kind === "new" ? "New game" : "Switch"}
      onConfirm={confirmLeave}
      onCancel={cancelConfirm}
    />
  );

  if (!snap || !human || !view) {
    return (
      <div className="ward">
        {header}
        <div className="play">
          <div className="stage">
            <div className="loading">Dealing…</div>
          </div>
        </div>
        {dialog}
      </div>
    );
  }

  const turnName = snap.players[snap.turn_idx]?.name ?? "?";
  const hint = gameOver
    ? "Game over."
    : isPaused
      ? "Game paused."
      : !myTurn
        ? `${turnName} is deciding…`
        : view.hint;

  const playEnabled = interactive && !!singleCard && !!view.playMove;
  const discardEnabled = interactive && selection.length >= 1;

  function handlePlay() {
    if (playEnabled && singleCard && view?.playMove) playCard(singleCard.id, moveTargets(view.playMove));
  }

  function handleDiscard() {
    if (discardEnabled) discardCards(selection);
  }

  return (
    <div className="ward">
      {header}

      <div className="play">
        <div className="stage">
          <div className="stage-canvas">
            <TableScene
              snapshot={snap}
              mode={mode}
              selection={selection}
              targetOrgans={view.targetOrgans}
              pendingOrgan={pendingOrgan?.organ_id ?? null}
              targetPlayers={view.targetPlayers}
              showGhostSlot={view.showGhostSlot}
              lastAction={lastAction}
              thinkingPlayer={thinkingPlayer}
              turnDeadline={mode === "mp" ? turnDeadline : null}
              animSpeed={mode === "solo" ? animSpeed : 1}
              interactive={interactive}
              onHandCardClick={(id) => {
                if (interactive) useStore.getState().toggleSelect(id);
              }}
              onOrganClick={(ref: OrganRef) => {
                if (interactive) apply(resolveOrganClick(snap, me, singleCard, pendingOrgan, ref));
              }}
              onPlayerClick={(p) => {
                if (interactive) apply(resolvePlayerClick(snap, me, singleCard, p));
              }}
              onGhostClick={() => {
                if (interactive) apply(resolveGhostClick(snap, me, singleCard));
              }}
              onBackgroundClick={() => useStore.getState().clearSelection()}
              onLayout={({ handTopFrac: f }) => setHandTopFrac(f)}
            />
          </div>

          <p className="hint" style={{ ["--handTop" as string]: `${handTopFrac * 100}%` }}>
            {hint}
          </p>

          <div className="actions">
            <button type="button" className="play-btn" onClick={handlePlay} disabled={!playEnabled}>
              Play
            </button>
            <button
              type="button"
              className="disc-btn"
              onClick={handleDiscard}
              disabled={!discardEnabled}
              aria-label={selection.length ? `Discard ${selection.length} selected` : "Discard"}
            >
              {selection.length ? `Discard ${selection.length}` : "Discard"}
            </button>
          </div>
        </div>

        <SidePanel snap={snap} mode={mode} />
      </div>

      {dialog}
      <Toast />
      <Banner />
      <PauseOverlay />
    </div>
  );
}
