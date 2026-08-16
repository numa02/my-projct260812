import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-ai-settings-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
}

test.describe("AIプロバイダ設定画面(T-068)", () => {
  test("未設定の状態でフォームが表示され、保存するとAPIキー入力欄がクリアされ「設定済み」になる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/ai-provider");

    await expect(page.getByText("未設定")).toBeVisible();
    await expect(page.getByLabel("APIキー")).toHaveValue("");
    await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();

    await page.getByLabel("APIキー").fill("sk-test-dummy-key");
    await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();
    await expect(page.getByText("設定済み")).toBeVisible();
    await expect(page.getByLabel("APIキー")).toHaveValue("");
  });

  test("保存後に再読み込みしてもプロバイダ・モデルの選択内容が復元される(APIキーは復元されない)", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/ai-provider");

    await page.getByLabel("AIプロバイダ").selectOption({ label: "Anthropic" });
    await page.getByLabel("モデル").selectOption({ label: "claude-opus-5" });
    await page.getByLabel("APIキー").fill("sk-ant-test-dummy-key");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("AIプロバイダ")).toHaveValue("anthropic");
    await expect(page.getByLabel("モデル")).toHaveValue("claude-opus-5");
    await expect(page.getByLabel("APIキー")).toHaveValue("");
    await expect(page.getByText("設定済み")).toBeVisible();
  });

  test("プロバイダを切り替えるとモデル選択が既定モデルにリセットされる", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/ai-provider");

    await expect(page.getByLabel("モデル")).toHaveValue("gpt-5-mini");
    await page.getByLabel("AIプロバイダ").selectOption({ label: "Google Gemini" });
    await expect(page.getByLabel("モデル")).toHaveValue("gemini-2.5-flash");
  });
});
