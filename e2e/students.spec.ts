import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-students-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function createClass(page: Page, grade: string, displayName: string): Promise<void> {
  await page.goto("/classes");
  await page.getByRole("button", { name: "クラスを作成" }).click();
  await page.getByLabel("学年").fill(grade);
  await page.getByLabel("クラス表示名").fill(displayName);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("クラスを作成しました")).toBeVisible();
}

test.describe("生徒名簿画面(T-055, T-055b, T-056)", () => {
  test("クラスが0件の場合はクラス管理画面への導線が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/students");
    await expect(page.getByText("まだクラスが登録されていません")).toBeVisible();
    await page.getByRole("button", { name: "クラス管理画面へ" }).click();
    await expect(page).toHaveURL(/\/classes$/);
  });

  test("クラスを切り替えると生徒一覧・インポート対象が切り替わる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "2", "2年1組");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await expect(page.getByText("まだ生徒が登録されていません")).toBeVisible();

    await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
    await page.getByLabel(/出席番号,氏名/).fill("1,生徒A");
    await page.getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByText("1件の生徒を登録しました")).toBeVisible();
    await expect(page.getByText("生徒A")).toBeVisible();

    await page.getByLabel("クラス").selectOption({ label: "2年1組" });
    await expect(page.getByText("まだ生徒が登録されていません")).toBeVisible();
    await expect(page.getByText("生徒A")).not.toBeVisible();
  });

  test("必須項目欠落・出席番号重複行はエラー一覧として表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });

    await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
    await page
      .getByLabel(/出席番号,氏名/)
      .fill("1,生徒A\n,氏名だけ\n2,生徒B\n2,重複太郎");
    await page.getByRole("button", { name: "取り込む" }).click();

    await expect(page.getByText("2件のエラーがあります")).toBeVisible();
    await expect(page.getByText(/出席番号または氏名が空です/)).toBeVisible();
    await expect(page.getByText(/取り込みデータ内で出席番号が重複しています/)).toBeVisible();
    await expect(page.getByText("生徒A")).toBeVisible();
    await expect(page.getByText("生徒B")).toBeVisible();
  });

  test("仮名コードが表示され、生徒削除には確認ダイアログが必要", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });

    await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
    await page.getByLabel(/出席番号,氏名/).fill("10,生徒A");
    await page.getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByText("1件の生徒を登録しました")).toBeVisible();

    // 仮名コード: 学年1・組番号1・出席番号10 → "1-01-10"
    await expect(page.getByText("1-01-10")).toBeVisible();

    await page.getByRole("button", { name: "生徒Aを削除" }).click();
    await expect(
      page.getByText("この生徒を削除すると、記録済みのメモ・所感もすべて完全に削除され、復元できません。"),
    ).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("生徒を削除しました")).toBeVisible();
    await expect(page.getByText("まだ生徒が登録されていません")).toBeVisible();
  });
});
