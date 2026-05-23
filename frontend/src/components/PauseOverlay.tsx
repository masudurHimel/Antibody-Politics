import { useStore } from "../game/store";
import { terminateRoom } from "../game/room";

export function PauseOverlay() {
  const isPaused = useStore((s) => s.isPaused);
  const waitingFor = useStore((s) => s.waitingFor);
  const room = useStore((s) => s.room);
  const mySeat = useStore((s) => s.mySeat);
  const token = useStore((s) => s.playerToken);
  const terminated = useStore((s) => s.terminated);

  if (!isPaused && !terminated) return null;

  const waitingNames = waitingFor
    .map((seat) => room?.players.find((p) => p.seat === seat)?.name)
    .filter(Boolean)
    .join(", ");
  const isHost = !!room?.players.find((p) => p.seat === mySeat)?.is_host;

  async function terminate() {
    if (!room || !token) return;
    try {
      await terminateRoom(room.id, token);
    } catch (e) {
      useStore.getState().setToast((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center text-text p-6">
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center border"
        style={{
          background: "rgba(10,30,20,0.95)",
          borderColor: "rgba(255,255,255,0.10)",
        }}
      >
        {terminated ? (
          <>
            <h2
              className="font-chunky font-black text-3xl mb-2"
              style={{ color: "var(--accent)" }}
            >
              GAME TERMINATED
            </h2>
            <p className="opacity-70 text-sm">The host ended this game.</p>
          </>
        ) : (
          <>
            <h2
              className="font-chunky font-black text-3xl mb-2"
              style={{ color: "var(--accent)" }}
            >
              PAUSED
            </h2>
            <p className="mb-6 text-sm">
              Waiting for <strong>{waitingNames || "player"}</strong> to
              reconnect…
            </p>
            {isHost && (
              <button
                onClick={terminate}
                className="font-chunky text-xs tracking-[0.3em] px-6 py-3 rounded-full border border-red-400/60 text-red-300"
              >
                TERMINATE GAME
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
