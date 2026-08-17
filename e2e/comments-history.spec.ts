import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-comment-history-${crypto.randomUUID()}@example.com`;
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

async function importStudents(page: Page, className: string, csv: string): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: className });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill(csv);
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText(/件の生徒を登録しました/)).toBeVisible();
}

async function openCommentsForStudentA(page: Page): Promise<void> {
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: "1年1組" });
  await page.getByRole("link", { name: "生徒Aの所感" }).click();
  await expect(page).toHaveURL(/\/comments\/students\//);
}

async function createManualComment(
  page: Page,
  input: { startDate: string; endDate: string; content: string },
): Promise<void> {
  await page.getByRole("radio", { name: "履歴" }).click();
  await page.getByRole("button", { name: "手動で作成する" }).click();
  await page.getByLabel("開始日").fill(input.startDate);
  await page.getByLabel("終了日").fill(input.endDate);
  await page.getByLabel("所感").fill(input.content);
  await page.getByRole("button", { name: "保存" }).click();
}

test.describe("所感画面・履歴タブ(T-067)", () => {
  test("所感が1件もない場合は案内が表示され、手動作成・生成タブへの導線がある", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await openCommentsForStudentA(page);
    await page.getByRole("radio", { name: "履歴" }).click();

    await expect(page.getByText("まだ所感が保存されていません")).toBeVisible();
    await page.getByRole("button", { name: "「生成」タブ" }).click();
    await expect(page.getByRole("radio", { name: "生成", checked: true })).toBeVisible();
  });

  test("手動で所感を作成・保存でき、一覧に表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await openCommentsForStudentA(page);
    await createManualComment(page, {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      content: "手動で入力した所感文です。",
    });

    await expect(page.getByText("所感を保存しました")).toBeVisible();
    await expect(page.getByText("2026-04-01 〜 2026-04-30")).toBeVisible();
    await expect(page.getByText("手動作成")).toBeVisible();
    await expect(page.getByText("手動で入力した所感文です。")).toBeVisible();
  });

  test("一覧から選択した所感を編集して保存すると内容が更新される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await openCommentsForStudentA(page);
    await createManualComment(page, {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      content: "編集前の所感文です。",
    });
    await expect(page.getByText("所感を保存しました")).toBeVisible();

    await page.getByText("2026-04-01 〜 2026-04-30").click();
    const contentField = page.getByLabel("所感");
    await expect(contentField).toHaveValue("編集前の所感文です。");
    // 既存の編集時は期間が読み取り専用になる
    await expect(page.getByLabel("開始日")).toBeDisabled();

    await contentField.fill("編集後の所感文です。");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("所感を保存しました").last()).toBeVisible();
    await expect(page.getByText("編集後の所感文です。")).toBeVisible();
    await expect(page.getByText("編集前の所感文です。")).not.toBeVisible();
  });

  test("既存の期間と重複する新規手動作成では上書き確認ダイアログが表示される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await openCommentsForStudentA(page);
    await createManualComment(page, {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      content: "1件目の所感文です。",
    });
    await expect(page.getByText("所感を保存しました")).toBeVisible();

    await page.getByRole("button", { name: "手動で作成する" }).click();
    await page.getByLabel("開始日").fill("2026-04-01");
    await page.getByLabel("終了日").fill("2026-04-30");
    await page.getByLabel("所感").fill("同じ期間の2件目の所感文です。");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(
      page.getByText("この期間の所感は既に保存されています。上書きしますか"),
    ).toBeVisible();
    await page.getByRole("button", { name: "続行" }).click();

    await expect(page.getByText("所感を保存しました").last()).toBeVisible();
    await expect(page.getByText("同じ期間の2件目の所感文です。")).toBeVisible();
    await expect(page.getByText("1件目の所感文です。")).not.toBeVisible();
  });

  test("キャンセルすると編集内容が破棄され、既存の所感は変更されない", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await importStudents(page, "1年1組", "1,生徒A");

    await openCommentsForStudentA(page);
    await createManualComment(page, {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      content: "変更しない所感文です。",
    });
    await expect(page.getByText("所感を保存しました")).toBeVisible();

    await page.getByText("2026-04-01 〜 2026-04-30").click();
    await page.getByLabel("所感").fill("キャンセルするので保存されない内容");
    await page.getByRole("button", { name: "キャンセル" }).click();

    await expect(page.getByLabel("所感")).not.toBeVisible();
    await expect(page.getByText("変更しない所感文です。")).toBeVisible();
  });
});
