import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // CLI/build-generated directories not maintained as source:
    // (.claude/worktrees/にgit worktreeを作ると、その中のソースとビルド成果物まで
    //  対象になってしまうため除外する)
    ".claude/**",
    "**/.next/**",
    "supabase/**",
    ".open-next/**",
    ".wrangler/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
