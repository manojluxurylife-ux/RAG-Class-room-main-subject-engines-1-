import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        board: "#16241d",
        board2: "#1f3328",
        board3: "#284134",
        chalk: "#f4f1e8",
        chalkdim: "#b9c4ba",
        marigold: "#e8a33d",
        marigolddim: "#b97f26",
        blue: "#7fb1cf",
        leaf: "#7fb069",
        terracotta: "#d68a63",
      },
      fontFamily: {
        display: ["Kalam", "cursive"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/container-queries")],
};
export default config;
