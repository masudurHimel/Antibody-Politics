import { useEffect, useRef, useState, type FormEvent } from "react";
import { PACES, useStore } from "../game/store";
import { startSoloGame } from "../game/actions";
import { createRoom, joinRoom, loadToken, storeToken } from "../game/room";
import { CardFan, PregameHeader } from "./pregameUi";
import { NAME_MAX, ROOM_CODE_LEN, SEAT_TINTS, isCompleteRoomCode, normalizeRoomCode } from "./pregame";

const PACE_OPTIONS = [
  { label: "Relaxed", factor: PACES.relaxed },
  { label: "Normal", factor: PACES.normal },
  { label: "Fast", factor: PACES.fast },
];

const HOW = [
  {
    t: "Build",
    d: "Lay down 4 healthy organs of different colours. The first complete body wins. A Wild organ counts as any colour.",
  },
  {
    t: "Attack",
    d: "Play viruses on rivals' organs: one infects, a second destroys. Treatments steal, swap and spread trouble.",
  },
  {
    t: "Protect",
    d: "Medicine cures a virus or vaccinates an organ. Two medicines make an organ immune for good.",
  },
];

/** Home: explains the game and offers the two ways to play. */
export default function NewGame({
  onSoloStarted,
  onRoomEntered,
  focusMp,
}: {
  onSoloStarted: () => void;
  /** created or joined a room (or reused a cached token for it) */
  onRoomEntered: (roomId: string, token: string, seat: number) => void;
  /** bump to scroll to the multiplayer panel and focus the name field */
  focusMp: number;
}) {
  const animSpeed = useStore((s) => s.animSpeed);
  const setPace = useStore((s) => s.setPace);
  const [soloBusy, setSoloBusy] = useState(false);
  const [soloErr, setSoloErr] = useState<string | null>(null);

  const [name, setName] = useState(() => localStorage.getItem("mp:lastName") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [mpErr, setMpErr] = useState<string | null>(null);
  const mpRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusMp) return;
    mpRef.current?.scrollIntoView({ block: "center" });
    nameRef.current?.focus({ preventScroll: true });
  }, [focusMp]);

  async function playSolo() {
    setSoloBusy(true);
    setSoloErr(null);
    try {
      await startSoloGame();
      onSoloStarted();
    } catch (e) {
      setSoloErr((e as Error).message || "Could not start a game");
      setSoloBusy(false);
    }
  }

  function needName(): string | null {
    const n = name.trim();
    if (n) return n;
    setMpErr("Enter your name first.");
    nameRef.current?.focus();
    return null;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = needName();
    if (!n) return;
    setBusy("create");
    setMpErr(null);
    try {
      const r = await createRoom(n);
      storeToken(r.room_id, r.player_token);
      localStorage.setItem("mp:lastName", n);
      onRoomEntered(r.room_id, r.player_token, r.seat);
    } catch (err) {
      setMpErr((err as Error).message);
      setBusy(null);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isCompleteRoomCode(code)) {
      setMpErr(`Room codes are ${ROOM_CODE_LEN} characters, like ABCD.`);
      codeRef.current?.focus();
      return;
    }
    // Already in this room on this device: go straight back to its lobby.
    const cached = loadToken(code);
    if (cached) {
      onRoomEntered(code, cached, -1);
      return;
    }
    const n = needName();
    if (!n) return;
    setBusy("join");
    setMpErr(null);
    try {
      const r = await joinRoom(code, n);
      storeToken(code, r.player_token);
      localStorage.setItem("mp:lastName", n);
      onRoomEntered(code, r.player_token, r.seat);
    } catch (err) {
      setMpErr((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="ward pg">
      <PregameHeader subtitle="The Virus! card game · online" />

      <main className="pg-home">
        <section className="pg-hero" aria-labelledby="pgTag">
          <div className="pg-hero-txt">
            <h2 id="pgTag" className="pg-tag">
              Build a healthy body.
              <br />
              <em>Infect everyone else's.</em>
            </h2>
            <p className="pg-lede">
              A digital table for <b>Virus!</b>, the card game. Be the first of 4 players to own four healthy organs,
              using viruses, medicine and dirty tricks.
            </p>
          </div>
          <CardFan />
        </section>

        <div className="pg-choices">
          <section className="pg-choice" aria-labelledby="soloTitle">
            <p className="pg-kicker">Solo ward</p>
            <h2 id="soloTitle">You vs 3 bots</h2>
            <p className="pg-desc">Start right away. No sign-up, no waiting for friends.</p>
            <ul className="pg-mini" aria-label="Seats: you and 3 bots">
              {["You", "Bot", "Bot", "Bot"].map((who, i) => (
                <li key={i}>
                  <span className="pg-av" style={{ background: SEAT_TINTS[i] }} aria-hidden="true">
                    {i === 0 ? "YOU" : "B" + i}
                  </span>
                  {who}
                </li>
              ))}
            </ul>
            <div className="pace pg-pace" role="group" aria-label="Bot pace">
              <h4>Bot pace</h4>
              <div className="opts">
                {PACE_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={animSpeed === o.factor}
                    onClick={() => setPace(o.factor)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pg-grow" />
            <button type="button" className="pg-btn" onClick={playSolo} disabled={soloBusy}>
              {soloBusy ? "Dealing…" : "Play solo"}
            </button>
            {soloErr && (
              <p className="pg-err" role="alert">
                {soloErr}
              </p>
            )}
          </section>

          <section className="pg-choice" id="multiplayer" ref={mpRef} aria-labelledby="mpTitle">
            <p className="pg-kicker">Multiplayer table</p>
            <h2 id="mpTitle">Play with friends online</h2>
            <p className="pg-desc">Up to 4 players. Empty seats become bots.</p>

            <form className="pg-form" onSubmit={create}>
              <label className="pg-label" htmlFor="pgName">
                Your name
              </label>
              <div className="pg-row">
                <input
                  id="pgName"
                  ref={nameRef}
                  className="pg-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_MAX}
                  autoComplete="nickname"
                  placeholder="e.g. Dr. Ada"
                />
                <button type="submit" className="pg-btn" disabled={busy !== null}>
                  {busy === "create" ? "Creating…" : "Create room"}
                </button>
              </div>
            </form>

            <form className="pg-form pg-join" onSubmit={join}>
              <label className="pg-label" htmlFor="pgCode">
                Have a code?
              </label>
              <div className="pg-row">
                <input
                  id="pgCode"
                  ref={codeRef}
                  className="pg-input pg-code-in"
                  value={code}
                  onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                  maxLength={ROOM_CODE_LEN}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABCD"
                  aria-describedby="pgCodeHelp"
                />
                <button type="submit" className="pg-btn ghost" disabled={busy !== null}>
                  {busy === "join" ? "Joining…" : "Join"}
                </button>
              </div>
              <small id="pgCodeHelp" className="pg-help">
                4-character room code from the host's invite.
              </small>
            </form>
            {mpErr && (
              <p className="pg-err" role="alert">
                {mpErr}
              </p>
            )}
          </section>
        </div>

        <section className="pg-how" aria-labelledby="howTitle">
          <h3 id="howTitle">How to win</h3>
          <ol>
            {HOW.map((s, i) => (
              <li key={s.t}>
                <span className="pg-step">{i + 1}</span>
                <div>
                  <b>{s.t}</b>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
