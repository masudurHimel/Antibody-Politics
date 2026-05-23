import { useEffect, useState } from "react";

const FULL_BUDGET_MS = 10_000;

export function TurnTimer({ deadlineMs }: { deadlineMs: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (deadlineMs == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  if (deadlineMs == null) return null;

  const remainingMs = Math.max(0, deadlineMs - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = Math.max(0, Math.min(100, (remainingMs / FULL_BUDGET_MS) * 100));
  const dash = (pct / 100) * 100.5;

  return (
    <div className="inline-flex items-center gap-2 font-chunky tracking-[0.25em] text-sm">
      <svg width="22" height="22" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} 100.5`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span>{remainingSec}s</span>
    </div>
  );
}
