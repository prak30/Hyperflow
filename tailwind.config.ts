import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111316",
        panel: "#f6f2e8",
        line: "#d8cdb8",
        gold: "#c8931d",
        flame: "#ef5b37",
        mint: "#2b9f7e",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(39, 30, 11, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
