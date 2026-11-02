import { useEffect, useState } from "react";
import { useStore, PACES } from "../game/store";
import type { Mode } from "../three/contract";
import type { PlayerView, Snapshot } from "../game/types";
import { Avatar } from "./Avatar";
import { ActivityLog } from "./ActivityLog";

const REACTIONS = [
  { emoji: "👏", label: "Applause" },
  { emoji: "😱", label: "Shocked" },
  { emoji: "🦠", label: "Germ" },
  { emoji: "🙏", label: "Mercy" },
];

const PACE_OPTIONS = [
  { label: "Relaxed", factor: PACES.relaxed },
  { label: "Normal", factor: PACES.normal },
  { label: "Fast", factor: PACES.fast },
];

const healthy = (p: PlayerView) => p.body.filter((o) => o.status !== "infected").length;

/** Multiplayer turn timer bar: drains from when the deadline arrived to the deadline itself. */
function TimerBar({ deadline }: { deadline: number }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.max(1, deadline - start);
  const pct = Math.max(0, Math.min(100, ((deadline - now) / total) * 100));
  const secs = Math.ceil(Math.max(0, deadline - now) / 1000);
  return (
    <span className="tbar" role="timer" aria-label={`${secs} seconds left`}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

function TurnBox({ snap, mode }: { snap: Snapshot; mode: Mode }) {
  const turnNo = useStore((s) => s.turnNo);
  const turnDeadline = useStore((s) => s.turnDeadline);
  const cur = snap.turn_idx;
  const over = snap.winner_idx !== null;
  const mine = cur === snap.viewer_idx && !over;
  const name = snap.players[cur]?.name ?? "?";
  const status = over ? "Game over" : mine ? "pick a card" : mode === "solo" ? "thinking…" : "choosing a move…";
  return (
    <div className={`turnbox${mine ? " mine" : ""}`} aria-live="polite">
      <span className="av">
        <Avatar seed={`${snap.game_id}:${cur}`} size={30} />
      </span>
      <div className="tb">
        <b>{over ? "Game over" : mine ? "Your turn" : `${name}'s turn`}</b>
        <small>
          Turn {turnNo} · {status}
        </small>
        {mode === "mp" && !over && turnDeadline != null && <TimerBar key={turnDeadline} deadline={turnDeadline} />}
      </div>
    </div>
  );
}

export function SidePanel({ snap, mode }: { snap: Snapshot; mode: Mode }) {
  const room = useStore((s) => s.room);
  const animSpeed = useStore((s) => s.animSpeed);
  const setPace = useStore((s) => s.setPace);
  const [pops, setPops] = useState<{ id: number; emoji: string }[]>([]);
  const over = snap.winner_idx !== null;

  function react(emoji: string) {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, emoji }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1500);
  }

  return (
    <aside className="side" aria-label="Game panel">
      <div className="side-head">
        <b>Antibody Politics</b>
        <span>{mode === "solo" ? "Solo · vs 3 bots" : `Room ${room?.id ?? ""}`}</span>
      </div>

      <TurnBox snap={snap} mode={mode} />

      <div>
        <h4>Players</h4>
        <div className="plist">
          {snap.players.map((p) => {
            const h = healthy(p);
            const online = room?.players.find((r) => r.seat === p.idx)?.connected ?? true;
            const isMe = p.idx === snap.viewer_idx;
            return (
              <div key={p.idx} className={`prow${p.idx === snap.turn_idx && !over ? " active" : ""}`}>
                <span className="av">
                  <Avatar seed={`${snap.game_id}:${p.idx}`} size={26} />
                  {isMe &&
                    pops.map((x) => (
                      <span key={x.id} className="react-pop" aria-hidden>
                        {x.emoji}
                      </span>
                    ))}
                </span>
                <span className="nm">
                  {mode === "mp" && (
                    <i className={`ping${online ? "" : " off"}`} role="img" aria-label={online ? "online" : "offline"} />
                  )}
                  {isMe ? "You" : p.name}
                  <small>
                    {p.hand_count} cards · {p.body.length} organ{p.body.length === 1 ? "" : "s"}
                  </small>
                </span>
                <span className="pips" role="img" aria-label={`${Math.min(h, 4)} of 4 healthy`}>
                  {[0, 1, 2, 3].map((i) => (
                    <i key={i} className={i < h ? "on" : ""} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="pilesline">
          Deck {snap.deck_count} · Discard {snap.discard_count}
        </p>
      </div>

      {mode === "solo" && (
        <div className="pace">
          <h4>Game pace</h4>
          <div className="opts" role="group" aria-label="Game pace">
            {PACE_OPTIONS.map((o) => (
              <button key={o.label} type="button" aria-pressed={animSpeed === o.factor} onClick={() => setPace(o.factor)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "mp" && (
        <div className="reacts" role="group" aria-label="Send a reaction">
          {REACTIONS.map((r) => (
            <button key={r.emoji} type="button" aria-label={r.label} onClick={() => react(r.emoji)}>
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="act">
        <h4>Activity</h4>
        <ActivityLog />
      </div>

      <details>
        <summary>How to play</summary>
        <ul>
          <li>Win with 4 healthy organs of different colours.</li>
          <li>Click a card to select it. Click more to select up to 3.</li>
          <li>One card selected: click a glowing target, or press Play.</li>
          <li>Discard throws away every selected card. You draw back up to 3.</li>
          <li>Esc or a click on empty table clears the selection.</li>
        </ul>
      </details>
    </aside>
  );
}
