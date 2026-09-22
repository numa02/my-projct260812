import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // node_modulesと.claude/worktrees配下は再帰パターンで除外する。
    // 素の"node_modules"はルート直下しか外れず、git worktreeを.claude/worktrees/に作ると
    // その中のソースと依存パッケージのテストまで拾ってしまう(151件→2244件になった)
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
      "e2e",
      "supabase",
      "tests/db",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
