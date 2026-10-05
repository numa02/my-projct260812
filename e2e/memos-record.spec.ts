import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-record-${crypto.randomUUID()}@example.com`;
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

/** 科目管理画面で、その科目の単元を1件登録する(UN-010) */
async function createUnit(page: Page, subjectName: string, unitName: string): Promise<void> {
  await page.goto("/subjects");
  await page.getByRole("button", { name: `${subjectName}の単元` }).click();
  await page.getByLabel(`${subjectName}の単元名`).fill(unitName);
  await page.getByRole("button", { name: "単元を追加" }).click();
  await expect(page.getByText("単元を登録しました")).toBeVisible();
}

async function importStudents(page: Page, className: string, csv: string): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: className });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill(csv);
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText(/件の生徒を登録しました/)).toBeVisible();
}

/** 一括モードで月曜1限の科目を設定する(授業記録画面のテスト用の下準備) */
async function setUpMaster(page: Page): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

test.describe("授業記録画面(T-063)", () => {
  test("科目またはクラスが未設定の日時では記録できない案内が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await setUpMaster(page); // 月曜1限のみ設定、火曜1限は未設定のまま

    await page.goto("/memos/record?date=2026-04-07&period=1"); // 2026-04-07は火曜日
    await expect(
      page.getByText("この時間には科目またはクラスが設定されていないため、記録できません"),
    ).toBeVisible();
  });

  test("生徒名をクリックして展開し、メモを個別に保存できる。他の生徒の行には影響しない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A\n2,生徒B");
    await setUpMaster(page);

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await expect(page.getByText("国語 / 1年1組")).toBeVisible();

    // 生徒Aの行を展開してメモを保存
    await page.getByRole("button", { name: /生徒A/ }).click();
    await expect(
      page.getByText("本文に書いた氏名等の情報はそのままAIへ送信されます"),
    ).toBeVisible();
    await page.getByLabel("メモ").fill("よく発言できていた");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();

    // 折りたたんでも「入力済み」インジケーターが表示される
    await page.getByRole("button", { name: /生徒A/ }).click();
    await expect(page.getByRole("button", { name: /生徒A/ })).toContainText("入力済み");

    // 生徒Bの行には一切影響していない(未入力のまま)
    await page.getByRole("button", { name: /生徒B/ }).click();
    await expect(page.getByRole("button", { name: /生徒B/ })).not.toContainText("入力済み");
    await expect(page.getByLabel("メモ")).toHaveValue("");
  });

  test("共有区分を「共有しない」に変更して保存できる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByRole("switch", { name: "共有区分" }).click();
    await expect(page.getByText("共有しない")).toBeVisible();
    await expect(
      page.getByText("本文に書いた氏名等の情報はそのままAIへ送信されます"),
    ).not.toBeVisible();

    await page.getByLabel("メモ").fill("非公開メモ");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();

    // 再度開くと保存した内容と共有区分が復元される
    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByRole("button", { name: /生徒A/ }).click();
    await expect(page.getByLabel("メモ")).toHaveValue("非公開メモ");
    await expect(page.getByText("共有しない")).toBeVisible();
  });

  // 単元の記録(UN-011)。単元はコマごとに1つで、そのコマのメモ全件に同じものが入る
  test("その科目に単元が未登録の場合は案内が表示され、メモの記録は従来どおりできる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await expect(
      page.getByText("まだ単元が登録されていません(科目管理画面で登録できます)"),
    ).toBeVisible();

    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByLabel("メモ", { exact: true }).fill("単元なしでも保存できる");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();
  });

  test("単元を選んでメモを保存でき、同じコマを開き直すとその単元が選択済みになる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createUnit(page, "国語", "詩を読もう");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await page.getByLabel("単元").selectOption({ label: "詩を読もう" });

    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByLabel("メモ", { exact: true }).fill("音読の声が大きくなった");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();

    // 同じコマを開き直すと、保存済みメモの単元が初期選択される
    await page.goto("/memos/record?date=2026-04-06&period=1");
    await expect(page.getByLabel("単元")).toHaveValue(/.+/);
    await expect(
      page.getByLabel("単元").locator("option:checked"),
    ).toHaveText("詩を読もう");
  });

  test("単元を変更するとそのコマの保存済みメモの単元もまとめて更新される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createUnit(page, "国語", "詩を読もう");
    await createUnit(page, "国語", "物語を読む");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    // 「詩を読もう」でメモを保存する
    await page.goto("/memos/record?date=2026-04-06&period=1");
    await page.getByLabel("単元").selectOption({ label: "詩を読もう" });
    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByLabel("メモ", { exact: true }).fill("音読の声が大きくなった");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();

    // 単元を選び直すと、保存済みのメモの単元も変わる
    await page.getByLabel("単元").selectOption({ label: "物語を読む" });
    await expect(page.getByText("このコマの1件のメモの単元を更新しました")).toBeVisible();

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await expect(
      page.getByLabel("単元").locator("option:checked"),
    ).toHaveText("物語を読む");

    // 生徒別メモ一覧の見出しにも新しい単元が出る
    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒A", exact: true }).click();
    await expect(page.getByText(/1限 ・ 国語 ・ 物語を読む/)).toBeVisible();
  });

  test("未入力のまま保存しようとするとエラーが表示され、保存されない", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await page.goto("/memos/record?date=2026-04-06&period=1");
    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを入力してください")).toBeVisible();
  });
});
