// Dev-only harness: mounts TableScene on a fake snapshot with a few scripted moves, so the table can be eyeballed
// without a backend. Mount it from a throwaway entry (it is not imported by the app).
import { useMemo, useState } from "react";
import type { Card, Color, Organ, Snapshot } from "../../game/types";
import type { LastAction, Mode } from "../contract";
import { TableScene } from "../TableScene";

const card = (id: string, type: Card["type"], color: Color, treatment_kind: Card["treatment_kind"] = null): Card => ({
  id,
  type,
  color,
  treatment_kind,
});
const organ = (id: string, color: Color, attached: Card[] = [], status: Organ["status"] = "free"): Organ => ({ id, color, attached, status });

export function fakeSnapshot(n = 4): Snapshot {
  const names = ["You", "Dr. Mendel", "Nurse Vex", "Intern Pip", "kofi_md", "Lena R."];
  return {
    game_id: "dev",
    viewer_idx: 0,
    turn_idx: 0,
    winner_idx: null,
    deck_count: 41,
    discard_count: 6,
    discard_top: card("treatment-multi-60", "treatment", "multi", "transplant"),
    event_log: [],
    players: Array.from({ length: n }, (_, p) => ({
      idx: p,
      name: names[p],
      is_bot: p > 0,
      hand:
        p === 0
          ? [card("virus-blue-30", "virus", "blue"), card("organ-yellow-15", "organ", "yellow"), card("medicine-red-40", "medicine", "red")]
          : null,
      hand_count: 3,
      body:
        p === 0
          ? [
              organ("organ-red-0", "red", [card("medicine-red-41", "medicine", "red")], "vaccinated"),
              organ("organ-green-5", "green"),
              organ("organ-blue-10", "blue", [card("virus-blue-31", "virus", "blue")], "infected"),
            ]
          : p === 1
            ? [
                organ("organ-blue-11", "blue"),
                organ("organ-multi-20", "multi", [card("medicine-blue-50", "medicine", "blue"), card("medicine-multi-56", "medicine", "multi")], "immunized"),
              ]
            : p === 2
              ? [organ("organ-red-1", "red", [card("virus-multi-39", "virus", "multi")], "infected"), organ("organ-yellow-16", "yellow"), organ("organ-green-6", "green")]
              : [organ(`organ-yellow-${17 + p}`, "yellow")],
    })),
  };
}

/** scripted follow-ups to watch the hero arc and the flair */
function step(s: Snapshot, i: number): Snapshot {
  const next: Snapshot = structuredClone(s);
  const me = next.players[0];
  if (i % 3 === 0) {
    // viewer infects Dr. Mendel's blue organ
    const v = me.hand!.find((c) => c.type === "virus");
    if (v) {
      me.hand = me.hand!.filter((c) => c !== v).concat(card(`medicine-green-${100 + i}`, "medicine", "green"));
      const o = next.players[1].body[0];
      o.attached.push(v);
      o.status = "infected";
      next.deck_count--;
    }
  } else if (i % 3 === 1) {
    // Nurse Vex cures her red organ with a fresh medicine (both go to the discard)
    const o = next.players[2].body[0];
    const med = card(`medicine-multi-${200 + i}`, "medicine", "multi");
    o.attached = [];
    o.status = "free";
    next.discard_top = med;
    next.discard_count += 2;
    next.deck_count--;
  } else {
    // Intern Pip plays a new organ
    next.players[3].body.push(organ(`organ-blue-${300 + i}`, "blue"));
    next.deck_count--;
  }
  return next;
}

export default function SceneHarness() {
  const [mode, setMode] = useState<Mode>("solo");
  const [n, setN] = useState(4);
  const [snap, setSnap] = useState(() => fakeSnapshot(4));
  const [i, setI] = useState(0);
  const [action, setAction] = useState<LastAction | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [deadline] = useState(() => Date.now() + 45000);
  const targetOrgans = useMemo(() => new Set(selection.length === 1 ? ["organ-blue-11", "organ-yellow-16"] : []), [selection]);
  const showGhost = selection.length === 1 && snap.players[0].hand!.find((c) => c.id === selection[0])?.type === "organ";

  const advance = () => {
    const next = step(snap, i);
    setAction({ player: i % 3 === 0 ? 0 : i % 3 === 1 ? 2 : 3, kind: "play", seq: i + 1 });
    setSnap(next);
    setI(i + 1);
    setSelection([]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: 8, background: "#122024", color: "#EAF0EA" }}>
        <button onClick={advance}>Next move</button>
        <button
          onClick={() => {
            const m = mode === "solo" ? "mp" : "solo";
            const c = m === "mp" ? 5 : 4;
            setMode(m);
            setN(c);
            setSnap({ ...fakeSnapshot(c), game_id: "dev-" + m });
          }}
        >
          Mode: {mode} ({n})
        </button>
        <span>selection: {selection.join(", ") || "none"}</span>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <TableScene
          snapshot={snap}
          mode={mode}
          selection={selection}
          targetOrgans={targetOrgans}
          pendingOrgan={null}
          targetPlayers={new Set()}
          showGhostSlot={showGhost}
          lastAction={action}
          thinkingPlayer={mode === "solo" ? 1 : null}
          turnDeadline={mode === "mp" ? deadline : null}
          animSpeed={1}
          interactive
          onHandCardClick={(id) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 3)))}
          onOrganClick={(r) => console.log("organ", r)}
          onPlayerClick={(p) => console.log("player", p)}
          onGhostClick={() => console.log("ghost")}
          onBackgroundClick={() => setSelection([])}
        />
      </div>
    </div>
  );
}
