import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-general-${crypto.randomUUID()}@example.com`;
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

/** 月曜1限=国語、月曜2限=総合 の時間割マスタを作る(一括モード・担任クラスのみ) */
async function setUpMaster(page: Page): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByLabel("月曜2限の科目").selectOption({ label: "総合" });
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

/**
 * 対象期間(開始日・終了日)を入力し、保存の完了まで待つ。
 * 保存が成功して初めて確定値になるため、案内文が消えるのを合図にする
 * (`docs/bugs.md` BUG-006と同じ理由)
 */
async function openPeriod(page: Page, startDate: string, endDate: string): Promise<void> {
  await page.getByLabel("開始日").fill(startDate);
  await page.getByLabel("終了日").fill(endDate);
  await expect(
    page.getByText("対象期間(開始日・終了日)を指定すると、このクラスの生徒一覧が表示されます"),
  ).toHaveCount(0);
}

async function openTab(page: Page, tabLabel: string) {
  await page.goto("/comments/class");
  await openPeriod(page, "2026-04-01", "2026-04-30");
  await page.getByRole("radio", { name: tabLabel }).click();
  return page.getByRole("group", { name: "生徒Aの行" });
}

/** 国語(月曜1限)と総合(月曜2限)のメモを1件ずつ持つ状態を作る */
async function setUpWithBothMemos(page: Page): Promise<void> {
  await signUpAndLogin(page);
  await createClass(page, "3", "1年1組");
  await createSubject(page, "国語");
  await createSubject(page, "総合");
  await importStudents(page, "1年1組", "1,生徒A");
  await setUpMaster(page);
  await recordMemo(page, "2026-04-06", 1, "国語の音読をがんばっていた");
  await recordMemo(page, "2026-04-06", 2, "地域の商店街について調べてまとめた");
}

test.describe("総合の所見(GS-)", () => {
  test("総合タブのプロンプトには科目「総合」のメモだけが含まれ、他教科のメモは含まれない", async ({
    page,
  }) => {
    await setUpWithBothMemos(page);

    const row = await openTab(page, "総合の所見");
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // APIキー未設定のため既定でプロンプトコピー運用になる
    const promptField = row.getByLabel("プロンプト");
    await expect(promptField).toHaveValue(/地域の商店街について調べてまとめた/);
    await expect(promptField).not.toHaveValue(/国語の音読をがんばっていた/);
    // 学年は自動で埋まり、仮名コードで置き換わる
    await expect(promptField).toHaveValue(/学年：3/);
    await expect(promptField).toHaveValue(/対象の児童・生徒：3-01-01/);
    await expect(promptField).not.toHaveValue(/生徒A/);
  });

  test("学習タブのプロンプトからは科目「総合」のメモが除外される", async ({ page }) => {
    await setUpWithBothMemos(page);

    const row = await openTab(page, "学習の所見");
    await row.getByRole("button", { name: "AIで生成する" }).click();

    // 学習と総合で材料が重複しないよう、学習側からは科目「総合」を除外する
    const promptField = row.getByLabel("プロンプト");
    await expect(promptField).toHaveValue(/国語の音読をがんばっていた/);
    await expect(promptField).not.toHaveValue(/地域の商店街について調べてまとめた/);
  });

  test("科目「総合」のメモしかない場合、学習タブでは送信可能なメモが存在しない扱いになる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "3", "1年1組");
    await createSubject(page, "総合");
    await importStudents(page, "1年1組", "1,生徒A");
    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByLabel("月曜1限の科目").selectOption({ label: "総合" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
    await recordMemo(page, "2026-04-06", 1, "地域の商店街について調べてまとめた");

    const row = await openTab(page, "学習の所見");
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(row.getByText("送信可能なメモが存在しません")).toBeVisible();

    // 同じメモは総合タブでは材料になる
    await page.getByRole("radio", { name: "総合の所見" }).click();
    const generalRow = page.getByRole("group", { name: "生徒Aの行" });
    await generalRow.getByRole("button", { name: "AIで生成する" }).click();
    await expect(generalRow.getByLabel("プロンプト")).toHaveValue(
      /地域の商店街について調べてまとめた/,
    );
  });

  test("総合の所見を保存しても、学習の所見・生活の所見は変わらない", async ({ page }) => {
    await setUpWithBothMemos(page);

    // 先に学習の所見を保存しておく
    const learningRow = await openTab(page, "学習の所見");
    await learningRow.getByLabel("生徒Aの所見").fill("学習面の所見です。");
    await learningRow.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("生徒Aの所見を保存しました")).toBeVisible();

    // 総合の所見を保存する
    await page.getByRole("radio", { name: "総合の所見" }).click();
    const generalRow = page.getByRole("group", { name: "生徒Aの行" });
    await expect(generalRow.getByLabel("生徒Aの総合の所見")).toHaveValue("");
    await generalRow.getByLabel("生徒Aの総合の所見").fill("総合的な学習の時間の所見です。");
    await generalRow.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("生徒Aの総合の所見を保存しました")).toBeVisible();

    // 学習の所見は元の内容のまま
    await page.getByRole("radio", { name: "学習の所見" }).click();
    await expect(
      page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの所見"),
    ).toHaveValue("学習面の所見です。");

    // 生活の所見は空のまま
    await page.getByRole("radio", { name: "生活の所見" }).click();
    await expect(
      page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの生活の所見"),
    ).toHaveValue("");

    // 再読み込み後も総合の所見が復元される
    await page.reload();
    await page.getByRole("radio", { name: "総合の所見" }).click();
    await expect(
      page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの総合の所見"),
    ).toHaveValue("総合的な学習の時間の所見です。");
  });

  test("科目「総合」のメモがない場合は案内が表示され、生成もプロンプト作成もできない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "3", "1年1組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    // 月曜1限の国語のみ。総合の授業は設定しない
    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
    await recordMemo(page, "2026-04-06", 1, "国語の音読をがんばっていた");

    const row = await openTab(page, "総合の所見");
    await row.getByRole("button", { name: "AIで生成する" }).click();

    await expect(row.getByText("送信可能な総合の授業メモが存在しません")).toBeVisible();
    await expect(row.getByLabel("プロンプト")).toHaveCount(0);

    // 手入力での保存は従来どおりできる
    await row.getByLabel("生徒Aの総合の所見").fill("手入力の総合の所見です。");
    await row.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("生徒Aの総合の所見を保存しました")).toBeVisible();
  });

  test("総合の所見用のひな形を保存しても、学習用・生活用のひな形は変わらない", async ({
    page,
  }) => {
    await setUpWithBothMemos(page);

    await page.goto("/settings/prompt-template");
    await expect(page.getByLabel("総合の所見用のひな形", { exact: true })).toHaveValue(
      /総合的な学習の時間/,
    );

    await page
      .getByLabel("総合の所見用のひな形", { exact: true })
      .fill("総合用マーカー: {{pseudonymCode}} / {{memos}}");
    await page.getByRole("button", { name: "総合の所見用のひな形を保存" }).click();
    await expect(page.getByText("総合の所見用のひな形を保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("総合の所見用のひな形", { exact: true })).toHaveValue(
      /総合用マーカー/,
    );
    // 学習用・生活用は既定値のまま
    await expect(page.getByLabel("学習の所見用のひな形", { exact: true })).toHaveValue(
      /質の高い学習所見を作成します/,
    );
    await expect(page.getByLabel("生活の所見用のひな形", { exact: true })).toHaveValue(
      /質の高い生活所見を作成します/,
    );

    // 総合タブのプロンプトに反映される
    const row = await openTab(page, "総合の所見");
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(row.getByLabel("プロンプト")).toHaveValue(/総合用マーカー/);
  });
});
