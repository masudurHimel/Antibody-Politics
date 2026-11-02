import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../game/store";
import { setReady, startRoom } from "../game/room";
import { PregameHeader } from "./pregameUi";
import { SEAT_TINTS, initials, seatStatus, startBlockReason } from "./pregame";
import type { RoomPlayerView } from "../game/types";

function SeatPlate({ seat, p, mine }: { seat: number; p: RoomPlayerView | undefined; mine: boolean }) {
  const status = seatStatus(p);
  const ready = !!p && !p.is_bot && p.ready;
  return (
    <li className={`pg-seat${p ? "" : " empty"}${ready ? " ready" : ""}${mine ? " mine" : ""}`}>
      <span className="pg-av" style={p ? { background: SEAT_TINTS[seat % SEAT_TINTS.length] } : undefined} aria-hidden="true">
        {p ? initials(p.name) : "+"}
      </span>
      <span className="who">
        <b>
          {p ? p.name : `Seat ${seat + 1}`}
          {p?.is_host && (
            <span className="pg-star" title="Host" aria-label="host">
              {" "}
              ★
            </span>
          )}
        </b>
        <small>{mine ? `You · ${status}` : status}</small>
      </span>
      {ready && <span className="pg-dot" aria-hidden="true" />}
    </li>
  );
}

export default function Lobby({
  roomId,
  token,
  onStarted,
  onLeave,
}: {
  roomId: string;
  token: string;
  onStarted: () => void;
  onLeave: () => void;
}) {
  const room = useStore((s) => s.room);
  const mySeat = useStore((s) => s.mySeat);
  const toast = useStore((s) => s.toast);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteBase, setInviteBase] = useState<string>(location.origin);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/host_url")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b?.public_url) setInviteBase(b.public_url);
      })
      .catch(() => {});
  }, []);

  const me = useMemo(() => room?.players.find((p) => p.seat === mySeat) ?? null, [room, mySeat]);
  const isHost = !!me?.is_host;
  const inviteUrl = `${inviteBase.replace(/\/$/, "")}/join/${roomId}`;
  const blockReason = room ? startBlockReason(room.players, mySeat) : null;
  const humans = room?.players.filter((p) => !p.is_bot).length ?? 0;

  useEffect(() => {
    if (room?.status === "playing") onStarted();
  }, [room?.status, onStarted]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function toggleReady() {
    if (!me) return;
    try {
      await setReady(roomId, token, !me.ready);
    } catch (e) {
      useStore.getState().setToast((e as Error).message);
    }
  }

  async function start() {
    if (starting || blockReason) return;
    setStarting(true);
    try {
      await startRoom(roomId, token);
    } catch (e) {
      setStarting(false);
      useStore.getState().setToast((e as Error).message);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // No clipboard access (e.g. plain http on a LAN IP): select the link so it can be copied by hand.
      linkRef.current?.select();
    }
  }

  const leave = (
    <button type="button" className="ghost-btn" onClick={onLeave}>
      Leave room
    </button>
  );

  if (!room) {
    return (
      <div className="ward pg pg-w-lobby">
        <PregameHeader subtitle="Multiplayer table · lobby">{leave}</PregameHeader>
        <main className="pg-narrow">
          <p className="pg-connecting" role="status">
            Connecting to room {roomId}…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="ward pg pg-w-lobby">
      <PregameHeader subtitle="Multiplayer table · lobby">{leave}</PregameHeader>
      <main className="pg-lobby">
        <section className="pg-choice pg-invite" aria-labelledby="codeLabel">
          <p className="pg-kicker" id="codeLabel">
            Room code
          </p>
          <p className="pg-bigcode" aria-label={`Room code ${room.id.split("").join(" ")}`}>
            {room.id}
          </p>
          <p className="pg-desc">Send friends this link, or have them enter the code on the home screen.</p>
          <div className="pg-row">
            <input
              ref={linkRef}
              className="pg-input pg-link"
              value={inviteUrl}
              readOnly
              aria-label="Invite link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="pg-btn" onClick={copyInvite}>
              {copied ? "Copied ✓" : "Copy invite link"}
            </button>
          </div>
          <span className="pg-sr" role="status">
            {copied ? "Invite link copied" : ""}
          </span>
        </section>

        <section className="pg-choice" aria-labelledby="seatsTitle">
          <div className="pg-seats-head">
            <h2 id="seatsTitle">Seats</h2>
            <small>{humans}/4 players · empty seats become bots</small>
          </div>
          <ul className="pg-seats">
            {[0, 1, 2, 3].map((seat) => (
              <SeatPlate key={seat} seat={seat} p={room.players.find((x) => x.seat === seat)} mine={seat === mySeat} />
            ))}
          </ul>

          <div className="pg-ready">
            <button
              type="button"
              role="switch"
              aria-checked={!!me?.ready}
              className="pg-switch"
              onClick={toggleReady}
              disabled={!me}
            >
              <span className="pg-knob" aria-hidden="true" />
              <span>I'm ready</span>
            </button>
            <span className={`pg-state${me?.ready ? " on" : ""}`}>{me?.ready ? "Ready" : "Not ready"}</span>
          </div>

          <div className="pg-start">
            {isHost ? (
              <>
                <button
                  type="button"
                  className="pg-btn pg-start-btn"
                  onClick={start}
                  disabled={!!blockReason || starting}
                  aria-describedby="startHelp"
                >
                  {starting ? "Starting…" : "Start game"}
                </button>
                <p id="startHelp" className="pg-help" aria-live="polite">
                  {blockReason ?? "Everyone's ready. Empty seats will be filled by bots."}
                </p>
              </>
            ) : (
              <p className="pg-wait" aria-live="polite">
                {me?.ready ? "Waiting for the host to start" : "Get ready, then wait for the host to start"}
              </p>
            )}
          </div>
          <p className="pg-rule">The host (★) starts the game once every player is ready.</p>
          {toast && (
            <p className="pg-err" role="alert">
              {toast}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
