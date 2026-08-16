import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<string> {
  const email = `e2e-weekly-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
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

/** 一括モードで起算日+月曜1限・月曜2限の科目を設定する(週次時間割画面のテスト用の下準備) */
async function setUpMaster(page: Page, startDate: string): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByLabel("月曜2限の科目").selectOption({ label: "算数" });
  await page.getByLabel("起算日").fill(startDate);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

test.describe("週次時間割画面(T-061, T-062)", () => {
  test("起算日が未設定の場合は参照不可で、時間割マスタ設定画面への導線が表示される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/timetable/weekly");

    await expect(
      page.getByText("起算日が未設定のため週次時間割を表示できません"),
    ).toBeVisible();
    await page.getByRole("button", { name: "時間割マスタ設定画面へ" }).click();
    await expect(page).toHaveURL(/\/timetable\/master$/);
  });

  test("週番号・日付範囲の表示、マスタ内容の表示、週送り・週指定ナビゲーション", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    // 2026-04-06は月曜日
    await setUpMaster(page, "2026-04-06");

    // 初期表示は現在日付が属する週(今週または指定週)のため、まず起算日の週へ明示的に移動する
    await page.goto("/timetable/weekly");
    await page.getByLabel("週を指定").fill("2026-04-06");
    await expect(page.getByText("第1週")).toBeVisible();
    await expect(page.getByText("2026年4月6日(月)〜4月10日(金)")).toBeVisible();
    await expect(page.getByRole("gridcell").filter({ hasText: "国語" })).toBeVisible();
    await expect(page.getByRole("gridcell").filter({ hasText: "算数" })).toBeVisible();

    await page.getByRole("button", { name: "次の週へ" }).click();
    await expect(page.getByText("第2週")).toBeVisible();
    await expect(page.getByText("2026年4月13日(月)〜4月17日(金)")).toBeVisible();

    await page.getByRole("button", { name: "前の週へ" }).click();
    await page.getByRole("button", { name: "前の週へ" }).click();
    await expect(page.getByText("第0週")).toBeVisible();

    await page.getByLabel("週を指定").fill("2026-04-20");
    await expect(page.getByText("第3週")).toBeVisible();
    await expect(page.getByText("2026年4月20日(月)〜4月24日(金)")).toBeVisible();
  });

  test("マスの個別変更を保存すると「変更あり」表示になり、他の週には影響しない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    await setUpMaster(page, "2026-04-06");

    await page.goto("/timetable/weekly");
    await page.getByLabel("週を指定").fill("2026-04-06");
    await page.getByRole("gridcell").filter({ hasText: "国語" }).click();
    await expect(page.getByRole("heading", { name: "月曜1限" })).toBeVisible();

    await page.getByLabel("科目").selectOption({ label: "算数" });
    await page.getByLabel("クラス").selectOption({ label: "1年1組" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("個別変更を保存しました")).toBeVisible();

    const changedCell = page.getByRole("gridcell").filter({ hasText: "算数" }).first();
    await expect(changedCell).toContainText("1年1組");
    await expect(changedCell).toContainText("変更あり");

    // 翌週にはこの個別変更が影響しない(マスタ通り国語のまま)
    await page.getByRole("button", { name: "次の週へ" }).click();
    await expect(page.getByRole("gridcell").filter({ hasText: "変更あり" })).toHaveCount(0);
    await expect(page.getByRole("gridcell").filter({ hasText: "国語" })).toBeVisible();
  });

  test("「マスタの内容に戻す」で個別変更が削除されマスタの内容に戻る", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    await setUpMaster(page, "2026-04-06");

    await page.goto("/timetable/weekly");
    await page.getByLabel("週を指定").fill("2026-04-06");
    await page.getByRole("gridcell").filter({ hasText: "国語" }).click();
    await page.getByLabel("科目").selectOption({ label: "算数" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("個別変更を保存しました")).toBeVisible();

    await page.getByRole("gridcell").filter({ hasText: "変更あり" }).click();
    await page.getByRole("button", { name: "マスタの内容に戻す" }).click();
    await expect(page.getByText("マスタの内容に戻しました")).toBeVisible();

    await expect(page.getByRole("gridcell").filter({ hasText: "変更あり" })).toHaveCount(0);
    await expect(page.getByRole("gridcell").filter({ hasText: "国語" })).toBeVisible();
  });

  test("「この授業を記録する」でその日付・時限を指定して授業記録画面へ遷移しようとする", async ({
    page,
  }) => {
    // 注記: 授業記録画面自体はT-063で実装するため、実際に正しい画面が表示されることの
    // 確認はT-063実装時に行う。ここでは遷移先URLのdate/periodパラメータのみ検証する。
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");
    await setUpMaster(page, "2026-04-06");

    await page.goto("/timetable/weekly");
    await page.getByLabel("週を指定").fill("2026-04-06");
    await page.getByRole("gridcell").filter({ hasText: "国語" }).click();
    await page.getByRole("button", { name: "この授業を記録する" }).click();
    await expect(page).toHaveURL(/\/memos\/record\?date=2026-04-06&period=1$/);
  });
});
