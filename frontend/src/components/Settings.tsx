import { useStore } from "../game/store";

export function Settings() {
  const animSpeed = useStore((s) => s.animSpeed);
  const soundOn = useStore((s) => s.soundOn);
  return (
    <div className="space-y-2 text-sm">
      <label className="flex items-center justify-between gap-2">
        <span>Animation speed</span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={animSpeed}
          onChange={(e) => {
            const v = Number(e.target.value);
            localStorage.setItem("animSpeed", String(v));
            useStore.setState({ animSpeed: v });
          }}
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span>Sound</span>
        <input
          type="checkbox"
          checked={soundOn}
          onChange={(e) => {
            localStorage.setItem("soundOn", e.target.checked ? "1" : "0");
            useStore.setState({ soundOn: e.target.checked });
          }}
        />
      </label>
    </div>
  );
}
