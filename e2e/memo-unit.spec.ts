import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-memo-unit-${crypto.randomUUID()}@example.com`;
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

async function setUpMaster(page: Page): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

/** 2026-04-06・04-13・04-20はいずれも月曜日なので、同じ時限でも時間割の科目は変わらない */
async function recordMemo(
  page: Page,
  dateISO: string,
  content: string,
  unitName?: string,
): Promise<void> {
  await page.goto(`/memos/record?date=${dateISO}&period=1`);
  if (unitName) await page.getByLabel("単元").selectOption({ label: unitName });
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill(content);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();
}

/** docs/features/comments のE2Eと同じ理由で、確定するまで案内文が残ることを保存完了の合図に使う */
async function openPeriod(page: Page, startDate: string, endDate: string): Promise<void> {
  await page.getByLabel("開始日").fill(startDate);
  await page.getByLabel("終了日").fill(endDate);
  await expect(
    page.getByText("対象期間(開始日・終了日)を指定すると、このクラスの生徒一覧が表示されます"),
  ).toHaveCount(0);
}

test.describe("単元ごとの所見生成(UN-013)", () => {
  /** 2単元+単元未設定のメモを持つ生徒を1人作る */
  async function setUpMemos(page: Page): Promise<void> {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createUnit(page, "国語", "詩を読もう");
    await createUnit(page, "国語", "物語を読む");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);

    await recordMemo(page, "2026-04-06", "音読の声が大きくなった", "詩を読もう");
    await recordMemo(page, "2026-04-13", "場面の様子を具体的に説明できた", "物語を読む");
    await recordMemo(page, "2026-04-20", "単元を選ばずに記録したメモ");
  }

  test("単元ごとのカードが並び、選んだ案が連結して所見欄に反映される", async ({ page }) => {
    await setUpMemos(page);

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // 既定は従来どおり「まとめて生成」
    await expect(row.getByRole("radio", { name: "まとめて生成" })).toBeChecked();

    await row.getByRole("radio", { name: "単元ごとに生成" }).click();

    // 単元ごとのカードが、メモの日付順に並び、最後が「単元未設定」になる
    await expect(row.getByRole("checkbox", { name: "詩を読もうの案を採用する" })).toBeVisible();
    await expect(row.getByRole("checkbox", { name: "物語を読むの案を採用する" })).toBeVisible();
    await expect(row.getByRole("checkbox", { name: "単元未設定の案を採用する" })).toBeVisible();
    await expect(row.getByText("メモ1件").first()).toBeVisible();

    // 単元ごとのプロンプトには、その単元のメモだけが含まれる
    const poemPrompt = row.getByLabel("詩を読もうのプロンプト");
    await expect(poemPrompt).toHaveValue(/音読の声が大きくなった/);
    await expect(poemPrompt).not.toHaveValue(/単元を選ばずに記録したメモ/);
    await expect(poemPrompt).not.toHaveValue(/生徒A/); // 実名は含まれない

    // 2件の案を貼り付けて採用し、空行区切りで連結されることを確認する
    await row.getByLabel("詩を読もうのAIの応答を貼り付け").fill("詩の学習で音読に意欲的でした。");
    await row.getByRole("button", { name: "この単元の案にする" }).first().click();
    await expect(row.getByLabel("詩を読もうの所見案")).toHaveValue("詩の学習で音読に意欲的でした。");

    await row.getByLabel("物語を読むのAIの応答を貼り付け").fill("物語の場面を丁寧に読み取れました。");
    await row.getByRole("button", { name: "この単元の案にする" }).nth(1).click();

    // 貼り付けた案は既定で採用候補になる
    await expect(row.getByRole("checkbox", { name: "詩を読もうの案を採用する" })).toBeChecked();
    await expect(row.getByRole("checkbox", { name: "物語を読むの案を採用する" })).toBeChecked();
    // 案のない単元は選べない
    await expect(row.getByRole("checkbox", { name: "単元未設定の案を採用する" })).toBeDisabled();

    await row.getByRole("button", { name: /選択した案を所見欄に反映/ }).click();
    await expect(row.getByLabel("生徒Aの所見")).toHaveValue(
      "詩の学習で音読に意欲的でした。\n\n物語の場面を丁寧に読み取れました。",
    );

    // 保存すると、プロンプトコピー運用として記録される
    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所見を保存しました")).toBeVisible();
    await expect(row.getByText("AI生成(プロンプトコピー運用)")).toBeVisible();
  });

  test("採用した案を編集してから反映すると、編集後の内容が所見欄に入る", async ({ page }) => {
    await setUpMemos(page);

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await row.getByRole("radio", { name: "単元ごとに生成" }).click();

    await row.getByLabel("詩を読もうのAIの応答を貼り付け").fill("元の案");
    await row.getByRole("button", { name: "この単元の案にする" }).first().click();
    await row.getByLabel("詩を読もうの所見案").fill("教員が整えた案");

    await row.getByRole("button", { name: /選択した案を所見欄に反映/ }).click();
    await expect(row.getByLabel("生徒Aの所見")).toHaveValue("教員が整えた案");
  });

  test("生活の所見タブでは生成単位の切り替えが表示されない", async ({ page }) => {
    await setUpMemos(page);

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(row.getByRole("radio", { name: "単元ごとに生成" })).toBeVisible();

    await page.getByRole("radio", { name: "生活の所見" }).click();
    const lifeRow = page.getByRole("group", { name: "生徒Aの行" });
    await lifeRow.getByRole("button", { name: "AIで生成する" }).click();
    await expect(lifeRow.getByRole("radio", { name: "単元ごとに生成" })).toHaveCount(0);
    await expect(lifeRow.getByRole("radio", { name: "まとめて生成" })).toHaveCount(0);
  });

  test("対象期間に共有メモが1件もない場合は、生成単位を切り替えても案内が出るだけになる", async ({
    page,
  }) => {
    await setUpMemos(page);

    await page.goto("/comments/class");
    // メモのない期間を指定する
    await openPeriod(page, "2026-05-01", "2026-05-31");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await row.getByRole("radio", { name: "単元ごとに生成" }).click();

    await expect(row.getByText("送信可能なメモが存在しません")).toBeVisible();
    await expect(row.getByRole("button", { name: "すべての単元を生成" })).toHaveCount(0);
  });
});
