import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        text: "var(--text)",
        muted: "var(--muted)",
        cardback: "var(--card-back-a)",
        ink: "var(--card-ink)",
        paper: "var(--card-paper)",
        red: { game: "var(--c-red)", deep: "var(--c-red-d)" },
        green: { game: "var(--c-green)", deep: "var(--c-green-d)" },
        blue: { game: "var(--c-blue)", deep: "var(--c-blue-d)" },
        yellow: { game: "var(--c-yellow)", deep: "var(--c-yellow-d)" },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        chunky: ["'Bungee'", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -8px rgba(0,0,0,0.55)",
        cardLift: "0 24px 50px -10px rgba(0,0,0,0.65)",
      },
      keyframes: {
        floatY: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
      },
      animation: {
        floatY: "floatY 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
