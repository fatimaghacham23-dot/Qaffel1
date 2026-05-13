import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        cedar: "#116466",
        mint: "#d9f2e6",
        wheat: "#f8f3e7",
        tomato: "#d95f43"
      },
      boxShadow: {
        soft: "0 16px 50px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
