import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/db/**/*.test.{ts,tsx}"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
