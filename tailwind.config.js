import { defineConfig } from "@tailwindcss/vite";

export default defineConfig({
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d1117",
        card: "#111827",
        brand: "#3b82f6",
      },
    },
  },
});
