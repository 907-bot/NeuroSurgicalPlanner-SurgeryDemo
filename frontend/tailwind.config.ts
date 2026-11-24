import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: "#0f172a",
        "surface-border": "#1e293b",
        accent: "#38bdf8",
        "accent-dark": "#0284c7",
        tumor: "#ef4444",
        edema: "#f59e0b",
        vessel: "#3b82f6",
        brain: "#94a3b8",
      },
    },
  },
  plugins: [],
};
export default config;
