import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-export-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
}

async function createClass(page: Page, grade: string, displayName: string): Promise<void> {
  await page.goto("/classes");
  await page.getByRole("button", { name: "クラスを作成" }).click();
  await page.getByLabel("学年").fill(grade);
  await page.getByLabel("クラス表示名").fill(displayName);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("クラスを作成しました")).toBeVisible();
}

test.describe("設定画面・データエクスポート(T-070)", () => {
  test("実行前に個人情報を含む旨の確認画面が表示され、キャンセルするとダウンロードされない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/export");

    await page.getByRole("button", { name: "全データをエクスポート" }).click();
    await expect(
      page.getByText(
        "ダウンロードされるファイルには生徒の氏名など個人情報がそのまま含まれます。ファイルの保管・取り扱いには十分注意してください。",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("heading", { name: "全データをエクスポートしますか" })).not.toBeVisible();
  });

  test("確認後に実行すると、生徒ごとにメモ・所感がまとまったJSONがダウンロードされ、APIキー設定は含まれない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await page.goto("/settings/ai-provider");
    await page.getByLabel("APIキー").fill("sk-test-should-not-be-exported");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

    await page.goto("/settings/export");
    await page.getByRole("button", { name: "全データをエクスポート" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "エクスポートする" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^export_\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    const data = JSON.parse(content);

    expect(data.classes).toEqual([expect.objectContaining({ displayName: "1年1組" })]);
    expect(data.aiProviderSetting).toBeUndefined();
    expect(content).not.toContain("sk-test-should-not-be-exported");

    await expect(page.getByText("エクスポートが完了しました")).toBeVisible();
  });
});
