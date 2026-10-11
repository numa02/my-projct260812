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

/** 科目管理画面で、その科目の単元を1件登録する(UN-010) */
async function createUnit(page: Page, subjectName: string, unitName: string): Promise<void> {
  await page.goto("/subjects");
  await page.getByRole("button", { name: `${subjectName}の単元` }).click();
  await page.getByLabel(`${subjectName}の単元名`).fill(unitName);
  await page.getByRole("button", { name: "単元を追加" }).click();
  await expect(page.getByText("単元を登録しました")).toBeVisible();
}

async function recordMemo(
  page: Page,
  period: number,
  content: string,
  unitName?: string,
  // 2026-04-06・2026-04-13はいずれも月曜日なので、同じ時限でも時間割の科目は変わらない
  dateISO = "2026-04-06",
): Promise<void> {
  await page.goto(`/memos/record?date=${dateISO}&period=${period}`);
  if (unitName) await page.getByLabel("単元").selectOption({ label: unitName });
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

  // 単元の表示(UN-012)
  test("教科別表示で、単元付きメモがある教科だけ単元の小見出しに分かれる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    await createUnit(page, "国語", "詩を読もう");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    // 国語: 単元付き。算数: 単元を登録していないので単元未設定のまま
    await recordMemo(page, 1, "国語メモ", "詩を読もう");
    await recordMemo(page, 2, "算数メモ");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒A", exact: true }).click();

    // 日付順の見出しに単元名が入る。単元未設定のメモには入らない
    await expect(page.getByText(/1限 ・ 国語 ・ 詩を読もう/)).toBeVisible();
    await expect(page.getByText(/2限 ・ 算数$/)).toBeVisible();

    await page.getByRole("radio", { name: "教科別" }).click();
    await expect(page.getByRole("heading", { name: "国語", level: 2 })).toBeVisible();
    // 単元付きメモがある国語だけ単元の小見出しが出る
    await expect(page.getByRole("heading", { name: "詩を読もう", level: 3 })).toBeVisible();
    // 算数には単元の小見出しが作られない(従来どおりメモがそのまま並ぶ)
    await expect(page.getByRole("heading", { name: "単元未設定", level: 3 })).toHaveCount(0);
    await expect(page.getByText("算数メモ")).toBeVisible();
  });

  test("同じ教科に単元付きと単元未設定が混在すると「単元未設定」の小見出しが最後に出る", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数"); // setUpMasterが月曜2限に設定するため登録しておく
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    // 先に単元なしで記録し、あとから単元を登録して別の日の同じコマに単元付きで記録する
    // (単元はコマごとに1つなので、同じ教科で混在させるには別の日に記録する)
    await recordMemo(page, 1, "単元なしの国語メモ");
    await createUnit(page, "国語", "詩を読もう");
    await recordMemo(page, 1, "単元ありの国語メモ", "詩を読もう", "2026-04-13");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒A", exact: true }).click();
    await page.getByRole("radio", { name: "教科別" }).click();

    const unitHeadings = page.getByRole("heading", { level: 3 });
    await expect(unitHeadings).toHaveCount(2);
    await expect(unitHeadings.nth(0)).toHaveText("詩を読もう");
    await expect(unitHeadings.nth(1)).toHaveText("単元未設定");
  });
});
