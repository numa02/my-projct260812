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
  await page.getByRole("button", { name: "登録" }).click();
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

async function setUpMaster(page: Page, startDate: string): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByLabel("起算日").fill(startDate);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

async function recordMemo(page: Page, dateISO: string, period: number, content: string): Promise<void> {
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
  await page.getByLabel("開始日").fill("2026-04-01");
  await page.getByLabel("終了日").fill("2026-04-30");
  return page.getByRole("group", { name: "生徒Aの行" });
}

test.describe("設定画面・プロンプトひな形編集(T-069)", () => {
  test("未編集の場合は本ツール既定のひな形が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    await expect(page.getByLabel("プロンプトひな形")).toHaveValue(/{{pseudonymCode}}/);
    await expect(page.getByLabel("プロンプトひな形")).toHaveValue(/{{memos}}/);
  });

  test("空欄では保存できない", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/settings/prompt-template");

    await page.getByLabel("プロンプトひな形").fill("");
    await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  test("編集して保存すると、以後の直接生成のプロンプトに反映される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/settings/prompt-template");
    await page
      .getByLabel("プロンプトひな形")
      .fill("カスタムひな形マーカー: {{pseudonymCode}} / {{memos}} / {{targetCharCount}}");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("プロンプトひな形を保存しました")).toBeVisible();

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

  test("編集して保存すると、プロンプトコピー運用のプロンプト表示にも反映される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/settings/prompt-template");
    await page
      .getByLabel("プロンプトひな形")
      .fill("コピー運用用カスタムマーカー: {{pseudonymCode}} / {{memos}}");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("プロンプトひな形を保存しました")).toBeVisible();

    const row = await openCommentsForStudentA(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();

    await expect(row.getByLabel("プロンプト")).toHaveValue(/コピー運用用カスタムマーカー/);
  });
});
