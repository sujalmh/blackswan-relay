import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ink: {
          DEFAULT: "#0F0F10",
          light: "#1A1A1E",
          muted: "#78716C",
        },
        paper: {
          DEFAULT: "#FFFCF5",
          deep: "#F5F1E8",
          card: "#FFFFFF",
        },
        signal: {
          DEFAULT: "#DC2626",
          muted: "#991B1B",
          bg: "#FEF2F2",
        },
        silence: {
          DEFAULT: "#065F46",
          light: "#047857",
          bg: "#ECFDF5",
        },
        amber: {
          DEFAULT: "#D97706",
          bg: "#FFFBEB",
        },
        violet: {
          DEFAULT: "#6D28D9",
          light: "#7C3AED",
          bg: "#F5F3FF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        "censor-reveal": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "signal-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "censor-reveal": "censor-reveal 1.2s ease-in-out",
        "signal-pulse": "signal-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
