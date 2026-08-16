import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<string> {
  const email = `e2e-classes-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  return email;
}

test.describe("クラス管理画面(T-053, T-054)", () => {
  test("クラスが0件の場合は案内と作成導線が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/classes");
    await expect(page.getByText("まだクラスがありません")).toBeVisible();
    await expect(page.getByRole("button", { name: "クラスを作成" })).toBeVisible();
  });

  test("通常学年・特支いずれでもクラスが作成され、組番号が自動採番される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/classes");

    // 1件目(学年1)
    await page.getByRole("button", { name: "クラスを作成" }).click();
    await page.getByLabel("学年").fill("1");
    await page.getByLabel("クラス表示名").fill("1年1組");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("クラスを作成しました")).toBeVisible();

    // 2件目(学年1、組番号2になるはず)
    await page.getByRole("button", { name: "クラスを作成" }).click();
    await page.getByLabel("学年").fill("1");
    await page.getByLabel("クラス表示名").fill("1年2組");
    await page.getByRole("button", { name: "保存" }).click();

    // 特支クラス(独立した採番)
    await page.getByRole("button", { name: "クラスを作成" }).click();
    await page.getByLabel("特別支援学級(特支)として登録する").click();
    await page.getByLabel("クラス表示名").fill("ひまわり組");
    await page.getByRole("button", { name: "保存" }).click();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(page.getByRole("row", { name: /1年1組/ })).toContainText("1");
    await expect(page.getByRole("row", { name: /1年2組/ })).toContainText("2");
    await expect(page.getByRole("row", { name: /ひまわり組/ })).toContainText("特支");
  });

  test("学年変更時は確認ダイアログが表示され、続行すると更新される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/classes");

    await page.getByRole("button", { name: "クラスを作成" }).click();
    await page.getByLabel("学年").fill("1");
    await page.getByLabel("クラス表示名").fill("1年1組");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("クラスを作成しました")).toBeVisible();

    await page.getByRole("row", { name: /1年1組/ }).getByRole("button", { name: "編集" }).click();
    await page.getByLabel("学年").fill("2");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByRole("heading", { name: "学年を変更しますか" })).toBeVisible();
    await page.getByRole("button", { name: "続行" }).click();
    await expect(page.getByText("クラスを更新しました")).toBeVisible();
    await expect(page.getByRole("row", { name: /1年1組/ })).toContainText("2");
  });

  test("生徒がいるクラスの削除は拒否される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/classes");
    await page.getByRole("button", { name: "クラスを作成" }).click();
    await page.getByLabel("学年").fill("1");
    await page.getByLabel("クラス表示名").fill("1年1組");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("クラスを作成しました")).toBeVisible();

    // 生徒を1人登録
    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
    await page.getByLabel(/出席番号,氏名/).fill("1,生徒A");
    await page.getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByText("1件の生徒を登録しました")).toBeVisible();

    await page.goto("/classes");
    await page.getByRole("row", { name: /1年1組/ }).getByRole("button", { name: "削除" }).click();
    await expect(
      page.getByText("生徒が登録されているため削除できません。先に生徒名簿から生徒を削除してください"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "クラスを削除しますか" })).not.toBeVisible();
  });
});
