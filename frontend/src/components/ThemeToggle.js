import { jsx as _jsx } from "react/jsx-runtime";
import { useStore } from "../game/store";
export function ThemeToggle() {
    const theme = useStore((s) => s.theme);
    return (_jsx("button", { onClick: () => useStore.getState().setTheme(theme === "dark" ? "light" : "dark"), className: "rounded-md border border-muted/40 px-3 py-1.5 text-sm hover:bg-muted/10", "aria-label": "Toggle theme", children: theme === "dark" ? "☾ Dark" : "☀ Light" }));
}
