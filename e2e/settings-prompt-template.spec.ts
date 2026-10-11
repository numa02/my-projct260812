import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-prompt-template-${crypto.randomUUID()}@example.com`;
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
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

async function recordMemo(
  page: Page,
  dateISO: string,
  period: number,
  content: string,
): Promise<void> {
  await page.goto(`/memos/record?date=${dateISO}&period=${period}`);
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill(content);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();
}

async function openCommentsForStudentA(page: Page) {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: "1年1組" });
  await page.getByRole("link", { name: "生徒Aの所見" }).click();
  await expect(page).toHaveURL(/\/comments\/class\//);
  await openPeriod(page, "2026-04-01", "2026-04-30");
  return page.getByRole("group", { name: "生徒Aの行" });
}

/**
 * 対象期間(開始日・終了日)を入力し、保存の完了まで待つ。
 *
 * 期間は入力のたびに`class`テーブルへのPATCHで保存され、楽観的更新を行わない方針のため、
 * 保存が成功して初めて確定値になる。確定するまでは「対象期間を指定すると…」の案内が
 * 表示されたままなので、これが消えるのを保存完了の合図として待つ。待たずにクラス切り替え等の
 * 次の操作へ進むと、負荷の高いときだけ後続のアサーションが失敗する。
 * PATCHのレスポンスを直接待たないのは、既に同じ値が入っている場合(再読み込み後など)は
 * 保存自体が走らず、待ち続けてしまうため
 */
async function openPeriod(page: Page, startDate: string, endDate: string): Promise<void> {
  await page.getByLabel("開始日").fill(startDate);
  await page.getByLabel("終了日").fill(endDate);
  await expect(
    page.getByText("対象期間(開始日・終了日)を指定すると、このクラスの生徒一覧が表示されます"),
  ).toHaveCount(0);
}

/** 所見の種類ごとの折りたたみを開く。既定で開いているのは「学習の所見」だけ(UN-034) */
async function openTemplateSection(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: title, exact: true }).click();
}

test.describe("設定画面・プロンプトひな形編集(T-069)", () => {
  test("未編集の場合は本ツール既定のひな形が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    const learningTemplate = page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true });
    await expect(learningTemplate).toHaveValue(/{{grade}}/);
    await expect(learningTemplate).toHaveValue(/{{targetCharCount}}/);
    await expect(learningTemplate).toHaveValue(/{{memos}}/);
    // 学期は本ツールに存在しない概念のため初期値に含めない
    await expect(learningTemplate).not.toHaveValue(/学期/);
  });

  test("空欄では保存できない", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    await page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true }).fill("");
    await expect(page.getByRole("button", { name: "学習の所見用のひな形(まとめて生成)を保存" })).toBeDisabled();
  });

  test("編集して保存すると、以後の直接生成のプロンプトに反映される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/settings/prompt-template");
    await page
      .getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true })
      .fill("カスタムひな形マーカー: {{pseudonymCode}} / {{memos}} / {{targetCharCount}}");
    await page.getByRole("button", { name: "学習の所見用のひな形(まとめて生成)を保存" }).click();
    await expect(page.getByText("学習の所見用のひな形(まとめて生成)を保存しました")).toBeVisible();

    await page.goto("/settings/ai-provider");
    await page.getByLabel("APIキー").fill("sk-test-dummy-key");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

    let capturedPrompt = "";
    await page.route("**/api/comments/generate", async (route) => {
      capturedPrompt = route.request().postDataJSON().prompt;
      await route.fulfill({ json: { rawText: "生成結果" } });
    });

    const row = await openCommentsForStudentA(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await row.getByRole("button", { name: "生成して所見欄に反映" }).click();
    await expect(row.getByLabel("生徒Aの所見")).toHaveValue("生成結果");

    expect(capturedPrompt).toContain("カスタムひな形マーカー");
  });

  test("編集して保存すると、プロンプトコピー運用のプロンプト表示にも反映される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/settings/prompt-template");
    await page
      .getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true })
      .fill("コピー運用用カスタムマーカー: {{pseudonymCode}} / {{memos}}");
    await page.getByRole("button", { name: "学習の所見用のひな形(まとめて生成)を保存" }).click();
    await expect(page.getByText("学習の所見用のひな形(まとめて生成)を保存しました")).toBeVisible();

    const row = await openCommentsForStudentA(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();

    await expect(row.getByLabel("プロンプト")).toHaveValue(/コピー運用用カスタムマーカー/);
  });

  // 「単元ごと」専用のひな形(UN-034)
  test("所見の種類ごとの折りたたみになっており、学習と総合は2つ・生活は1つのひな形を持つ", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    // 既定で「学習の所見」が開いている
    await expect(
      page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("学習の所見用のひな形(単元ごと)", { exact: true })).toBeVisible();
    // 他の種類は閉じている
    await expect(page.getByLabel("生活の所見用のひな形", { exact: true })).toHaveCount(0);

    await openTemplateSection(page, "総合の所見");
    await expect(
      page.getByLabel("総合の所見用のひな形(まとめて生成)", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("総合の所見用のひな形(単元ごと)", { exact: true })).toBeVisible();
    // 同時に開けるのは1つなので、学習は閉じる
    await expect(
      page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true }),
    ).toHaveCount(0);

    // 生活の所見は単元を持たないためひな形は1つだけ
    await openTemplateSection(page, "生活の所見");
    await expect(page.getByLabel("生活の所見用のひな形", { exact: true })).toBeVisible();
    await expect(page.getByLabel("生活の所見用のひな形(単元ごと)", { exact: true })).toHaveCount(0);
  });

  test("「単元ごと」用の既定ひな形は{{unitName}}を含み、まとめて生成用は含まない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    await expect(
      page.getByLabel("学習の所見用のひな形(単元ごと)", { exact: true }),
    ).toHaveValue(/{{unitName}}/);
    await expect(
      page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true }),
    ).not.toHaveValue(/{{unitName}}/);
  });

  test("「単元ごと」用を編集して保存しても、まとめて生成用は変わらない", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    const wholeTemplate = page.getByLabel("学習の所見用のひな形(まとめて生成)", { exact: true });
    const unitTemplate = page.getByLabel("学習の所見用のひな形(単元ごと)", { exact: true });
    const wholeBefore = await wholeTemplate.inputValue();

    await unitTemplate.fill("単元ごと専用マーカー: {{unitName}} / {{pseudonymCode}} / {{memos}}");
    await page
      .getByRole("button", { name: "学習の所見用のひな形(単元ごと)を保存", exact: true })
      .click();
    await expect(page.getByText("学習の所見用のひな形(単元ごと)を保存しました")).toBeVisible();

    await page.reload();
    await expect(unitTemplate).toHaveValue(/単元ごと専用マーカー/);
    await expect(wholeTemplate).toHaveValue(wholeBefore);
  });

  test("「単元ごとに生成」では単元ごと用のひな形が使われる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page);
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/settings/prompt-template");
    await page
      .getByLabel("学習の所見用のひな形(単元ごと)", { exact: true })
      .fill("単元ごと専用マーカー: {{unitName}} / {{memos}}");
    await page
      .getByRole("button", { name: "学習の所見用のひな形(単元ごと)を保存", exact: true })
      .click();
    await expect(page.getByText("学習の所見用のひな形(単元ごと)を保存しました")).toBeVisible();

    const row = await openCommentsForStudentA(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // まとめて生成では従来どおり「まとめて生成」用のひな形
    await expect(row.getByLabel("プロンプト")).not.toHaveValue(/単元ごと専用マーカー/);

    // 単元ごとに切り替えると、単元ごと用のひな形が使われる(単元未設定のカード)
    await row.getByRole("radio", { name: "単元ごとに生成" }).click();
    const unitPrompt = row.getByLabel("単元未設定のプロンプト");
    await expect(unitPrompt).toHaveValue(/単元ごと専用マーカー/);
    await expect(unitPrompt).toHaveValue(/単元未設定/);
  });
});
