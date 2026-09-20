import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  // ローカルのSupabaseスタックと開発サーバーを並列実行で共有するため、サインアップ直後の
  // 遷移など一部の待ちが既定の5秒に収まらないことがある。アプリ側の「自動リトライはしない」
  // 方針(F13)は保存処理に対するものであり、テスト実行のリトライはその対象外
  expect: { timeout: 10_000 },
  timeout: 60_000,
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
