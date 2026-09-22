import { defineConfig, devices } from "@playwright/test";

/**
 * 使い方説明書(docs/manual/)のキャプチャ撮影専用の設定。
 * `npm run test:e2e` の対象(e2e/)とは切り離し、明示的に実行したときだけ動かす。
 *   npx playwright test --config docs/manual/capture/playwright.manual.config.ts
 */
export default defineConfig({
  testDir: ".",
  // 画面の状態を順に作りながら撮影するため、並列実行もリトライもしない
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  expect: { timeout: 15_000 },
  timeout: 600_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
    // 説明書の画像はデスクトップ幅で統一し、拡大しても粗くならないよう2倍解像度で撮る
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
