import { test, expect, type Page } from "@playwright/test";
import { AI_MODEL } from "../shared/ai-models";

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
    // 画面の再読み込みなしで、登録済みのプロバイダと、そのプロバイダの固定モデルが設定状況の横に併記される
    await expect(page.getByText(`OpenAI / ${AI_MODEL.openai}`)).toBeVisible();
  });

  test("保存後に再読み込みしてもプロバイダの選択内容が復元される(APIキーは復元されない)", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/ai-provider");

    await page.getByLabel("AIプロバイダ").selectOption({ label: "Anthropic" });
    await page.getByLabel("APIキー").fill("sk-ant-test-dummy-key");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("AIプロバイダ")).toHaveValue("anthropic");
    await expect(page.getByLabel("APIキー")).toHaveValue("");
    await expect(page.getByText("設定済み")).toBeVisible();
    await expect(page.getByText(`Anthropic / ${AI_MODEL.anthropic}`)).toBeVisible();
  });

  test("モデルの選択欄は表示されない(プロバイダごとの固定モデルを使う)", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/ai-provider");

    await expect(page.getByLabel("AIプロバイダ")).toBeVisible();
    await expect(page.getByLabel("モデル")).toHaveCount(0);
    await page.getByLabel("AIプロバイダ").selectOption({ label: "Google Gemini" });
    await expect(page.getByLabel("モデル")).toHaveCount(0);
  });
});
