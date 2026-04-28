import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        moss: "#4d6857",
        clay: "#b85f42",
        field: "#f6f4ed",
        line: "#d9d4c7"
      }
    }
  },
  plugins: []
};

export default config;

