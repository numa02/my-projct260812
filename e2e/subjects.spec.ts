import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-subjects-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
}

test.describe("科目管理画面(T-057)", () => {
  // 「使用中の科目は削除できない」というRPC(delete_subject)側のビジネスルールは
  // tests/db/rpc-subject.test.ts で既に検証済み。ここでは画面からの登録・編集・
  // (未使用科目の)削除という基本操作を確認する。UIから科目を実際に使用状態にする
  // には授業記録画面(T-063、未実装)が必要なため、削除拒否のE2E確認はそちらに委ねる。
  test("科目を登録・編集・削除できる", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/subjects");

    await expect(page.getByText("まだ科目が登録されていません")).toBeVisible();

    await page.getByLabel("科目名").fill("国語");
    await page.getByRole("button", { name: "登録", exact: true }).click();
    await expect(page.getByText("科目を登録しました")).toBeVisible();
    await expect(page.getByText("国語", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "国語を編集" }).click();
    await page.getByRole("listitem").getByRole("textbox").fill("現代文");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("科目名を更新しました")).toBeVisible();
    await expect(page.getByText("現代文", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "現代文を削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("科目を削除しました")).toBeVisible();
    await expect(page.getByText("まだ科目が登録されていません")).toBeVisible();
  });
});
