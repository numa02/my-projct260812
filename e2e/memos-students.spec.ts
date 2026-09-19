import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-memolist-${crypto.randomUUID()}@example.com`;
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

async function createSubject(page: Page, name: string): Promise<void> {
  await page.goto("/subjects");
  await page.getByLabel("科目名").fill(name);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByText("科目を登録しました")).toBeVisible();
}

async function importStudents(page: Page, className: string, csv: string): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: className });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill(csv);
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText(/件の生徒を登録しました/)).toBeVisible();
}

async function setUpMaster(page: Page): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByLabel("月曜2限の科目").selectOption({ label: "算数" });
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

async function recordMemo(page: Page, period: number, content: string): Promise<void> {
  await page.goto(`/memos/record?date=2026-04-06&period=${period}`);
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill(content);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();
}

test.describe("生徒別メモ一覧画面(T-064)", () => {
  test("生徒名簿画面から生徒名をクリックするとクラス・生徒が選択済みで表示され、「戻る」で生徒名簿画面に戻れる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒A", exact: true }).click();

    await expect(page).toHaveURL(/\/memos\/students\/[0-9a-f-]+\?from=/);
    await expect(page.getByLabel("クラス")).toHaveValue(/./);
    await expect(page.getByLabel("生徒")).toHaveValue(/./);
    await expect(page.getByText("まだメモがありません")).toBeVisible();

    await page.getByRole("button", { name: "戻る" }).click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("メモが日付順・教科別で一覧表示され、編集・削除・共有区分切替ができる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await recordMemo(page, 1, "国語メモ");
    await recordMemo(page, 2, "算数メモ");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒A", exact: true }).click();

    // 日付順(初期表示): 両方のメモが表示される
    await expect(page.getByText("国語メモ")).toBeVisible();
    await expect(page.getByText("算数メモ")).toBeVisible();

    // 教科別表示: 科目ごとの見出しでグループ化される
    await page.getByRole("radio", { name: "教科別" }).click();
    await expect(page.getByRole("heading", { name: "国語" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "算数" })).toBeVisible();

    // 編集
    await page.getByRole("button", { name: /算数のメモを編集/ }).click();
    await page.getByLabel("メモ", { exact: true }).fill("算数メモ(改訂)");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを更新しました")).toBeVisible();
    await expect(page.getByText("算数メモ(改訂)")).toBeVisible();

    // 共有区分切替
    await page.getByRole("switch", { name: /国語の共有区分/ }).click();
    await expect(page.getByText(/共有区分を更新しました/)).toBeVisible();

    // 削除
    await page.getByRole("button", { name: /算数のメモを削除/ }).click();
    await expect(page.getByText("このメモを削除します。この操作は取り消せません。")).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("メモを削除しました")).toBeVisible();
    await expect(page.getByText("算数メモ(改訂)")).not.toBeVisible();
  });

  test("メニューから直接開くと、クラスは既定選択・生徒は未選択の状態で表示され、生徒を選ぶとメモが見られる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/classes");
    await page.getByRole("link", { name: "生徒別メモ一覧" }).click();

    await expect(page).toHaveURL(/\/memos\/students$/);
    await expect(page.getByLabel("クラス")).toHaveValue(/./);
    await expect(page.getByText("生徒を選択してください")).toBeVisible();

    await page.getByLabel("生徒").selectOption({ label: "生徒A" });
    await expect(page.getByText("まだメモがありません")).toBeVisible();
  });
});
