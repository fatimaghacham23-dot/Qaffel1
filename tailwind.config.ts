import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
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
      spacing: {
        "q-xs": "0.25rem",
        "q-sm": "0.5rem",
        "q-md": "0.75rem",
        "q-lg": "1rem",
        "q-xl": "1.5rem",
        "q-2xl": "2rem",
        "q-3xl": "2.5rem",
        "q-4xl": "3rem",
        "q-section": "3.5rem"
      },
      borderRadius: {
        "q-sm": "0.625rem",
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
        xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
        soft: "0 1px 0 rgba(15, 23, 42, 0.04), 0 24px 70px -42px rgba(15, 23, 42, 0.24)",
        card: "0 1px 0 rgba(15,23,42,0.03), 0 2px 6px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)",
        "card-hover": "0 1px 0 rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.06), 0 16px 48px -16px rgba(15,23,42,0.18)",
        elevated: "0 1px 0 rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.05), 0 16px 40px -12px rgba(15,23,42,0.16)",
        float: "0 2px 8px rgba(15,23,42,0.06), 0 18px 52px -12px rgba(15,23,42,0.22)"
      },
      transitionDuration: {
        "q-instant": "80ms",
        "q": "180ms",
        "q-fast": "120ms",
        "q-slow": "280ms",
        "q-expand": "320ms"
      },
      transitionTimingFunction: {
        "q": "cubic-bezier(0.22, 1, 0.36, 1)",
        "q-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "q-spring": "cubic-bezier(0.34, 1.42, 0.64, 1)",
        "q-decel": "cubic-bezier(0, 0, 0.2, 1)"
      },
      keyframes: {
        "q-fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "q-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "q-scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "q-slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)", filter: "blur(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" }
        },
        "q-success-pop": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "70%": { opacity: "1", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "q-fade-up": "q-fade-up 0.38s cubic-bezier(0.22, 1, 0.36, 1) both",
        "q-fade-in": "q-fade-in 0.32s ease-out both",
        "q-scale-in": "q-scale-in 0.22s cubic-bezier(0.34, 1.42, 0.64, 1) both",
        "q-slide-up": "q-slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        "q-success-pop": "q-success-pop 0.36s cubic-bezier(0.22, 1, 0.36, 1) both"
      }
    }
  },
  plugins: []
};

export default config;
