import { useState, type FormEvent } from "react";
import { joinRoom, storeToken } from "../game/room";
import { CardFan, PregameHeader } from "./pregameUi";
import { NAME_MAX } from "./pregame";

/** Landing page for an invite link (/join/<CODE>). */
export default function JoinRoom({
  roomId,
  onJoined,
  onCancel,
}: {
  roomId: string;
  onJoined: (roomId: string, token: string, seat: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem("mp:lastName") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = name.trim();
    if (!n) {
      setErr("Enter your name first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await joinRoom(roomId, n);
      storeToken(roomId, r.player_token);
      localStorage.setItem("mp:lastName", n);
      onJoined(roomId, r.player_token, r.seat);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="ward pg pg-w-narrow">
      <PregameHeader subtitle="The Virus! card game · online" />
      <main className="pg-narrow">
        <CardFan keys={["virus-green", "organ-red", "medicine-blue"]} />
        <section className="pg-choice" aria-labelledby="joinTitle">
          <p className="pg-kicker">Multiplayer table · invite</p>
          <h2 id="joinTitle">
            Join room <span className="pg-code-inline">{roomId}</span>
          </h2>
          <p className="pg-desc">
            Pick the name the others will see. The host starts once everyone is ready; empty seats become bots.
          </p>
          <form className="pg-form" onSubmit={submit}>
            <label className="pg-label" htmlFor="joinName">
              Your name
            </label>
            <input
              id="joinName"
              className="pg-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              placeholder="e.g. Dr. Ada"
            />
            {err && (
              <p className="pg-err" role="alert">
                {err}
              </p>
            )}
            <div className="pg-btns">
              <button type="button" className="pg-btn ghost" onClick={onCancel}>
                Back
              </button>
              <button type="submit" className="pg-btn" disabled={busy}>
                {busy ? "Joining…" : "Join"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
