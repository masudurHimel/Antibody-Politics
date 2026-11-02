import { useStore } from "../game/store";

/** Last 10 moves, newest first; the newest is highlighted (CSS `li:first-child`). */
export function ActivityLog() {
  const log = useStore((s) => s.snapshot?.event_log) ?? [];
  const tail = log.slice(-10).reverse();

  return (
    <ol aria-label="Last 10 moves">
      {tail.map((e, i) => (
        <li key={`${log.length - 1 - i}-${e}`}>{e}</li>
      ))}
      {tail.length === 0 && <li className="empty">No moves yet.</li>}
    </ol>
  );
}
