import { useStore } from "../game/store";

export function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  return (
    <button
      onClick={() => useStore.getState().setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md border border-muted/40 px-3 py-1.5 text-sm hover:bg-muted/10"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}
