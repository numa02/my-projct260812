import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-comments-class-${crypto.randomUUID()}@example.com`;
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

async function setApiKey(page: Page): Promise<void> {
  await page.goto("/settings/ai-provider");
  await page.getByLabel("APIキー").fill("sk-test-dummy-key");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();
}

async function openPeriod(page: Page, startDate: string, endDate: string): Promise<void> {
  await page.getByLabel("開始日").fill(startDate);
  await page.getByLabel("終了日").fill(endDate);
}

test.describe("所感管理画面(クラス単位一覧)", () => {
  test("クラスが0件の場合はクラス管理画面への導線が表示される(空状態)", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/comments/class");
    await expect(page.getByText("まだクラスが登録されていません")).toBeVisible();
    await page.getByRole("button", { name: "クラス管理画面へ" }).click();
    await expect(page).toHaveURL(/\/classes$/);
  });

  test("ナビゲーションメニューから開ける", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await page.goto("/students");
    await page.getByRole("link", { name: "所感管理" }).click();
    await expect(page).toHaveURL(/\/comments\/class$/);
    await expect(page.getByLabel("クラス")).toHaveValue(/./);
  });

  test("対象期間を指定するとクラス全員の氏名と所感入力欄が表示され、生徒名簿から遷移した生徒の行が目立つ", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A\n2,生徒B");

    await page.goto("/students");
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("link", { name: "生徒Aの所感" }).click();
    await expect(page).toHaveURL(/\/comments\/class\/[0-9a-f-]+\?student=/);

    // 期間未指定の間は一覧が出ない
    await expect(page.getByText("対象期間(開始日・終了日)を指定すると")).toBeVisible();

    await openPeriod(page, "2026-04-01", "2026-04-30");

    await expect(page.getByRole("group", { name: "生徒Aの行" })).toBeVisible();
    await expect(page.getByRole("group", { name: "生徒Bの行" })).toBeVisible();
  });

  test("手動で所感を入力して保存でき、同じ期間を再度開くと内容が復元される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByLabel("生徒Aの所感").fill("手動で入力した所感文です。");
    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();
    await expect(row.getByText("手動作成")).toBeVisible();

    await page.reload();
    await openPeriod(page, "2026-04-01", "2026-04-30");
    await expect(page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの所感")).toHaveValue(
      "手動で入力した所感文です。",
    );
  });

  test("対象期間を切り替えると、その期間の既存所感(なければ空欄)に切り替わる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");
    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByLabel("生徒Aの所感").fill("4月分の所感");
    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();

    // 別の期間に切り替えると空欄になる
    await openPeriod(page, "2026-05-01", "2026-05-31");
    await expect(row.getByLabel("生徒Aの所感")).toHaveValue("");

    // 元の期間に戻すと内容が復元される
    await openPeriod(page, "2026-04-01", "2026-04-30");
    await expect(row.getByLabel("生徒Aの所感")).toHaveValue("4月分の所感");
  });

  test("APIキー設定済みの場合、AI生成した内容が所感欄に反映され保存できる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");
    await setApiKey(page);

    await page.route("**/api/comments/generate", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.prompt).toContain("1-01-01"); // 仮名コードが含まれる
      await route.fulfill({ json: { rawText: "積極的に音読に取り組み、着実に力をつけています。" } });
    });

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(
      row.getByText("「共有する」区分のメモが仮名化された状態で外部のAIサービスに送信されます"),
    ).toBeVisible();
    await row.getByRole("button", { name: "生成して所感欄に反映" }).click();

    await expect(row.getByLabel("生徒Aの所感")).toHaveValue(
      "積極的に音読に取り組み、着実に力をつけています。",
    );

    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();
    await expect(row.getByText("AI生成(直接呼び出し)")).toBeVisible();
  });

  test("APIキー設定済みでも、教員が選べば「プロンプトを作成」を使える", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");
    await setApiKey(page);

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // 既定は「AIで直接生成」だが、教員が「プロンプトを作成」に切り替えられる
    await expect(row.getByRole("radio", { name: "AIで直接生成", checked: true })).toBeVisible();
    await row.getByRole("radio", { name: "プロンプトを作成" }).click();

    const promptField = row.getByLabel("プロンプト");
    await expect(promptField).toBeVisible();
    await expect(promptField).toHaveValue(/1-01-01/);

    await row.getByLabel("AIの応答を貼り付け").fill("プロンプトコピー運用で得た所感文です。");
    await row.getByRole("button", { name: "所感欄に反映" }).click();
    await expect(row.getByLabel("生徒Aの所感")).toHaveValue("プロンプトコピー運用で得た所感文です。");

    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();
    await expect(row.getByText("AI生成(プロンプトコピー運用)")).toBeVisible();
  });

  test("APIキー未設定で「AIで直接生成」を選ぶと、設定を促す案内が表示され生成はできない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // 既定は「プロンプトを作成」だが、教員が「AIで直接生成」に切り替えられる
    await expect(row.getByRole("radio", { name: "プロンプトを作成", checked: true })).toBeVisible();
    await row.getByRole("radio", { name: "AIで直接生成" }).click();

    await expect(
      row.getByText("APIキーが未設定のため、直接生成はできません"),
    ).toBeVisible();
    await expect(row.getByRole("link", { name: "AIプロバイダ設定へ" })).toBeVisible();
    await expect(row.getByRole("button", { name: "生成して所感欄に反映" })).not.toBeVisible();
  });

  test("対象期間内に共有メモが1件もない場合、AI生成セクションで送信可能なメモが存在しない旨が表示される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");
    await setApiKey(page);

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(row.getByText("送信可能なメモが存在しません")).toBeVisible();
  });

  test("APIキー未設定の場合、プロンプトが表示されコピーでき、貼り付けたテキストを所感欄に反映して保存できる", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await setUpMaster(page, "2026-04-06");
    await recordMemo(page, "2026-04-06", 1, "音読が上手にできました");

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");

    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByRole("button", { name: "AIで生成する" }).click();

    const promptField = row.getByLabel("プロンプト");
    await expect(promptField).toBeVisible();
    await expect(promptField).toHaveValue(/1-01-01/); // 仮名コードが含まれる
    await expect(promptField).toHaveValue(/音読が上手にできました/);
    await expect(promptField).not.toHaveValue(/生徒A/); // 実名は含まれない

    await row.getByRole("button", { name: "プロンプトをコピー" }).click();
    await expect(page.getByText("プロンプトをコピーしました")).toBeVisible();

    await row.getByLabel("AIの応答を貼り付け").fill("外部AIから得た所感文をそのまま貼り付けました。");
    await row.getByRole("button", { name: "所感欄に反映" }).click();

    await expect(row.getByLabel("生徒Aの所感")).toHaveValue(
      "外部AIから得た所感文をそのまま貼り付けました。",
    );

    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();
    await expect(row.getByText("AI生成(プロンプトコピー運用)")).toBeVisible();
  });

  test("過去の所感を見るセクションで、別期間の保存済み所感が閲覧できる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await page.goto("/comments/class");
    await openPeriod(page, "2026-04-01", "2026-04-30");
    const row = page.getByRole("group", { name: "生徒Aの行" });
    await row.getByLabel("生徒Aの所感").fill("4月分の所感");
    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生徒Aの所感を保存しました")).toBeVisible();

    await openPeriod(page, "2026-05-01", "2026-05-31");
    await expect(row.getByRole("button", { name: /過去の所感を見る/ })).toBeVisible();
    await row.getByRole("button", { name: /過去の所感を見る/ }).click();
    await expect(row.getByText("2026-04-01 〜 2026-04-30")).toBeVisible();
    await expect(row.getByText("4月分の所感")).toBeVisible();
  });
});
