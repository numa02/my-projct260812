import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-comments-${crypto.randomUUID()}@example.com`;
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

async function importStudents(page: Page, className: string, csv: string): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: className });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill(csv);
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText(/件の生徒を登録しました/)).toBeVisible();
}

test.describe("所感画面の骨格(T-065)", () => {
  test("クラスが0件の場合はクラス管理画面への導線が表示される(空状態)", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/comments/students/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("まだクラスが登録されていません")).toBeVisible();
    await page.getByRole("button", { name: "クラス管理画面へ" }).click();
    await expect(page).toHaveURL(/\/classes$/);
  });

  test("生徒名簿画面から所感アイコンをクリックするとクラス・生徒が選択済みで表示される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒Aの所感" }).click();

    await expect(page).toHaveURL(/\/comments\/students\/[0-9a-f-]+$/);
    await expect(page.getByLabel("クラス")).toHaveValue(/./);
    await expect(page.getByLabel("生徒")).toHaveValue(/./);
  });

  test("タブを切り替えてもクラス・生徒の選択状態が保持される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A\n2,生徒B");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒Aの所感" }).click();

    await expect(page).toHaveURL(/\/comments\/students\//);
    await expect(page.getByRole("radio", { name: "生成" })).toBeVisible();
    await expect(page.getByText("仮名コード")).toBeVisible();

    // 生徒を切り替えてからタブを切り替える
    await page.getByLabel("生徒").selectOption({ label: "生徒B" });
    await page.getByRole("radio", { name: "履歴" }).click();
    await expect(page.getByText("まだ所感が保存されていません")).toBeVisible();

    // タブを切り替えてもクラス・生徒の選択状態は変わらない
    await expect(page.getByLabel("クラス")).toHaveValue(/./);
    await expect(page.getByLabel("生徒")).toHaveValue(/./);
    const studentSelect = page.getByLabel("生徒");
    await expect(studentSelect.locator("option:checked")).toHaveText("生徒B");

    await page.getByRole("radio", { name: "生成" }).click();
    await expect(page.getByText("仮名コード")).toBeVisible();
    await expect(studentSelect.locator("option:checked")).toHaveText("生徒B");
  });

  test("クラスを切り替えると生徒選択がリセットされる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "2", "2年1組");
    await importStudents(page, "1年1組", "1,生徒A");
    await importStudents(page, "2年1組", "1,生徒B");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒Aの所感" }).click();

    // Next.jsのクライアントサイド遷移はPlaywrightのclick()のナビゲーション待機と同期しないため、
    // URLが遷移先に切り替わったことを明示的に待ってから次の操作(selectOption)に進む
    await expect(page).toHaveURL(/\/comments\/students\//);
    await page.getByLabel("クラス").selectOption({ label: "2年1組" });
    await expect(page.getByText("生徒を選択してください")).toBeVisible();
    await expect(page.getByLabel("生徒").locator("option")).toHaveText(["選択してください", "生徒B"]);
  });
});
