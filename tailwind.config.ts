import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "Noto Sans Arabic",
          "Noto Naskh Arabic",
          "sans-serif"
        ]
      },
      borderRadius: {
        "q-sm": "0.75rem",
        "q-md": "0.875rem",
        "q-lg": "1rem",
        "q-xl": "1.25rem",
        "q-2xl": "1.5rem",
        "q-3xl": "1.75rem"
      },
      colors: {
        ink: "#17202a",
        cedar: "#116466",
        mint: "#d9f2e6",
        wheat: "#f8f3e7",
        tomato: "#d95f43"
      },
      boxShadow: {
        soft: "0 1px 0 rgba(15, 23, 42, 0.04), 0 24px 70px -42px rgba(15, 23, 42, 0.24)",
        card: "0 1px 0 rgba(15, 23, 42, 0.04), 0 12px 34px -22px rgba(15, 23, 42, 0.22)",
        "card-hover": "0 1px 0 rgba(15, 23, 42, 0.05), 0 18px 48px -24px rgba(15, 23, 42, 0.28)"
      },
      transitionDuration: {
        "q": "180ms"
      },
      transitionTimingFunction: {
        "q": "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      keyframes: {
        "q-fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "q-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "q-success-pop": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "70%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "q-fade-up": "q-fade-up 0.42s cubic-bezier(0.22, 1, 0.36, 1) both",
        "q-fade-in": "q-fade-in 0.35s ease-out both",
        "q-success-pop": "q-success-pop 0.38s cubic-bezier(0.22, 1, 0.36, 1) both"
      }
    }
  },
  plugins: []
};

export default config;
