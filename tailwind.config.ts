import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        room: {
          bg: "#0c0e12",
          panel: "#151922",
          elevated: "#1c2230",
          border: "#2a3144",
          muted: "#8b939e",
        },
        trace: "#4ecdc4",
        signal: "#e8954a",
        alert: "#ff6b6b",
        command: "#a78bfa",
        "amber-warm": "#fbbf24",
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
