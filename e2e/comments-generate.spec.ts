import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-comment-gen-${crypto.randomUUID()}@example.com`;
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

async function setApiKey(page: Page): Promise<void> {
  await page.goto("/settings/ai-provider");
  await page.getByLabel("APIキー").fill("sk-test-dummy-key");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();
}

async function openCommentsForStudentA(page: Page): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: "1年1組" });
  await page.getByRole("link", { name: "生徒Aの所感" }).click();
  await expect(page).toHaveURL(/\/comments\/students\//);
}

test.describe("所感画面・生成タブ:直接呼び出し(T-066a)", () => {
  test("期間・目安文字数を指定して生成すると、AIの応答テキストがそのまま表示され保存できる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06"); // 月曜日
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");
    await setApiKey(page);

    await page.route("**/api/comments/generate", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.prompt).toContain("1-01-01"); // 仮名コードが含まれる
      await route.fulfill({ json: { rawText: "積極的に音読に取り組み、着実に力をつけています。" } });
    });

    await openCommentsForStudentA(page);
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");
    await page.getByLabel("目安文字数").fill("100");

    await expect(
      page.getByText("「共有する」区分のメモが仮名化された状態で外部のAIサービスに送信されます"),
    ).toBeVisible();
    await page.getByRole("button", { name: "生成" }).click();

    await expect(page.getByLabel("生成結果")).toHaveValue(
      "積極的に音読に取り組み、着実に力をつけています。",
    );

    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("所感を保存しました")).toBeVisible();
  });

  test("同じ期間で再度保存しようとすると上書き確認ダイアログが表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");
    await setApiKey(page);

    await page.route("**/api/comments/generate", async (route) => {
      await route.fulfill({ json: { rawText: "1回目の所感文" } });
    });

    await openCommentsForStudentA(page);
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");
    await page.getByRole("button", { name: "生成" }).click();
    await expect(page.getByLabel("生成結果")).toHaveValue("1回目の所感文");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("所感を保存しました")).toBeVisible();

    // 同じ期間で再度生成・保存
    await page.getByLabel("生成結果").fill("2回目の所感文(編集後)");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(
      page.getByText("この期間の所感は既に保存されています。上書きしますか"),
    ).toBeVisible();
    await page.getByRole("button", { name: "続行" }).click();
    await expect(page.getByText("所感を保存しました")).toBeVisible();
  });

  test("認証エラーが返った場合、所感は保存されずエラーが表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");
    await setApiKey(page);

    await page.route("**/api/comments/generate", async (route) => {
      await route.fulfill({
        status: 401,
        json: { error: { code: "AUTH_ERROR", message: "APIキーの認証に失敗しました" } },
      });
    });

    await openCommentsForStudentA(page);
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");
    await page.getByRole("button", { name: "生成" }).click();

    await expect(page.getByText("APIキーの認証に失敗しました")).toBeVisible();
    await expect(page.getByLabel("生成結果")).not.toBeVisible();
  });

  test("対象期間内に共有メモが1件もない場合、送信可能なメモが存在しない旨が表示され生成できない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await setApiKey(page);

    await openCommentsForStudentA(page);
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");

    await expect(page.getByText("送信可能なメモが存在しません")).toBeVisible();
    await expect(page.getByRole("button", { name: "生成" })).not.toBeVisible();
  });

  test("APIキー未設定の場合は直接生成できない旨と設定画面への導線が表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await openCommentsForStudentA(page);
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");

    await expect(
      page.getByText("APIキーが未設定のため直接生成はできません。設定画面でAPIキーを登録してください"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "生成" })).not.toBeVisible();
    await page.getByRole("link", { name: "AIプロバイダ設定画面へ" }).click();
    await expect(page).toHaveURL(/\/settings\/ai-provider$/);
  });
});
