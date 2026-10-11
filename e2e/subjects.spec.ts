import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-subjects-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
}

test.describe("科目管理画面(T-057)", () => {
  // 「使用中の科目は削除できない」というRPC(delete_subject)側のビジネスルールは
  // tests/db/rpc-subject.test.ts で既に検証済み。ここでは画面からの登録・編集・
  // (未使用科目の)削除という基本操作を確認する。UIから科目を実際に使用状態にする
  // には授業記録画面(T-063、未実装)が必要なため、削除拒否のE2E確認はそちらに委ねる。
  test("科目を登録・編集・削除できる", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/subjects");

    await expect(page.getByText("まだ科目が登録されていません")).toBeVisible();

    await page.getByLabel("科目名").fill("国語");
    await page.getByRole("button", { name: "登録", exact: true }).click();
    await expect(page.getByText("科目を登録しました")).toBeVisible();
    await expect(page.getByText("国語", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "国語を編集" }).click();
    await page.getByRole("listitem").getByRole("textbox").fill("現代文");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("科目名を更新しました")).toBeVisible();
    await expect(page.getByText("現代文", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "現代文を削除" }).click();
    await expect(
      page.getByText(/この科目に登録済みの単元もまとめて削除されます/),
    ).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("科目を削除しました")).toBeVisible();
    await expect(page.getByText("まだ科目が登録されていません")).toBeVisible();
  });

  // 単元マスタ(UN-010)。単元は科目の行を開いた中で管理する
  test("科目の行を開いて単元を登録・編集・削除できる", async ({ page }) => {
    await signUpAndLogin(page);
    await page.goto("/subjects");

    await page.getByLabel("科目名").fill("算数");
    await page.getByRole("button", { name: "登録", exact: true }).click();
    await expect(page.getByText("科目を登録しました")).toBeVisible();

    // 閉じている間は単元の欄が出ない
    await expect(page.getByRole("heading", { name: "単元" })).toHaveCount(0);

    const nameInput = page.getByLabel("算数の単元名", { exact: true });
    const addButton = page.getByRole("button", { name: "単元を追加", exact: true });

    await page.getByRole("button", { name: "算数の単元", exact: true }).click();
    await expect(page.getByText("まだ単元が登録されていません")).toBeVisible();

    await nameInput.fill("分数のかけ算");
    await addButton.click();
    await expect(page.getByText("単元を登録しました")).toBeVisible();
    await expect(page.getByText("分数のかけ算", { exact: true })).toBeVisible();
    // 追加後は入力欄がクリアされ、続けて次の単元を登録できる。
    // 2件目に進む合図にはトーストを使わない(4秒で消えるため、1件目のトーストを
    // 見てしまい、保存中の状態で次の操作に進むことがある)
    await expect(nameInput).toHaveValue("");

    await nameInput.fill("円の面積");
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByText("円の面積", { exact: true })).toBeVisible();
    await expect(nameInput).toHaveValue("");

    await page.getByRole("button", { name: "単元「円の面積」を編集" }).click();
    await page.getByLabel("円の面積の単元名").fill("円の面積の求め方");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("単元名を更新しました")).toBeVisible();
    await expect(page.getByText("円の面積の求め方", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "単元「円の面積の求め方」を削除" }).click();
    await expect(
      page.getByText(/この単元を使っているメモは単元未設定に戻ります/),
    ).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("単元を削除しました")).toBeVisible();
    await expect(page.getByText("円の面積の求め方", { exact: true })).toHaveCount(0);
    // 残った単元には影響しない
    await expect(page.getByText("分数のかけ算", { exact: true })).toBeVisible();
  });

  // 単元の貼り付け一括登録(UN-023)
  test("貼り付けで単元をまとめて登録でき、余分な列と登録済みの単元は取り込まれない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await page.goto("/subjects");

    await page.getByLabel("科目名").fill("算数");
    await page.getByRole("button", { name: "登録", exact: true }).click();
    await expect(page.getByText("科目を登録しました")).toBeVisible();

    await page.getByRole("button", { name: "算数の単元", exact: true }).click();
    // 科目用の「貼り付けで一括登録」と区別するため、単元側は科目名入りのaria-labelを持つ
    await page.getByRole("button", { name: "算数の単元を貼り付けで一括登録", exact: true }).click();

    const pasteArea = page.getByLabel("算数の単元名を貼り付け", { exact: true });
    const importButton = page.getByRole("button", { name: "取り込む", exact: true });

    // 空の状態では取り込めない
    await expect(importButton).toBeDisabled();

    // Excelから「単元名」「時数」の2列をそのまま貼った形。2列目は単元にならない
    await pasteArea.fill(["分数のかけ算\t12", "円の面積\t8", "比例と反比例\t10"].join("\n"));
    await expect(importButton).toBeEnabled();
    await importButton.click();

    // 完了の待機にはトーストではなく一覧と貼り付け欄の状態を使う(docs/bugs.md BUG-010)
    await expect(page.getByText("分数のかけ算", { exact: true })).toBeVisible();
    await expect(page.getByText("円の面積", { exact: true })).toBeVisible();
    await expect(page.getByText("比例と反比例", { exact: true })).toBeVisible();
    await expect(pasteArea).toHaveValue("");
    // 時数の列は単元として登録されない
    await expect(page.getByText("12", { exact: true })).toHaveCount(0);

    // 既に登録済みのものはスキップし、新しいものだけ追加される
    await pasteArea.fill(["分数のかけ算", "小数のかけ算"].join("\n"));
    await importButton.click();
    await expect(page.getByText("小数のかけ算", { exact: true })).toBeVisible();
    await expect(pasteArea).toHaveValue("");
    await expect(page.getByText("分数のかけ算", { exact: true })).toHaveCount(1);

    // 全件が登録済みなら新規追加は0件になる
    await pasteArea.fill("分数のかけ算");
    await importButton.click();
    await expect(
      page.getByText("登録済みの単元のみだったため、新規追加はありませんでした"),
    ).toBeVisible();
    await expect(pasteArea).toHaveValue("");
    await expect(page.getByText("分数のかけ算", { exact: true })).toHaveCount(1);
  });
});
