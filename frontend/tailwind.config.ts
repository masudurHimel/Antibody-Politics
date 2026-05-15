import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        accent: "var(--accent)",
        text: "var(--text)",
        muted: "var(--muted)",
        cardback: "var(--card-back)",
        red: { game: "var(--c-red)" },
        green: { game: "var(--c-green)" },
        blue: { game: "var(--c-blue)" },
        yellow: { game: "var(--c-yellow)" },
      },
      fontFamily: { display: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 10px 30px -8px rgba(0,0,0,0.5)" },
    },
  },
  plugins: [],
} satisfies Config;
