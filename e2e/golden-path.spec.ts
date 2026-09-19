import { test, expect } from "@playwright/test";

/**
 * ゴールデンパス(T-077): サインアップ→クラス作成→CSV登録→時間割設定→メモ記録→所見生成・保存
 * 各画面の細かい分岐は個別のspecでカバー済みのため、ここでは一連の主要フローが
 * 画面間の遷移を含めて最後まで通ることだけを確認する。
 */
test("サインアップからクラス作成・生徒登録・時間割設定・メモ記録・所見生成保存までの一連の流れが完了する", async ({
  page,
}) => {
  // 1. サインアップ
  const email = `e2e-golden-path-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);

  // 2. クラス作成
  await page.goto("/classes");
  await page.getByRole("button", { name: "クラスを作成" }).click();
  await page.getByLabel("学年").fill("1");
  await page.getByLabel("クラス表示名").fill("1年1組");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("クラスを作成しました")).toBeVisible();

  // 3. 科目登録
  await page.goto("/subjects");
  await page.getByLabel("科目名").fill("国語");
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByText("科目を登録しました")).toBeVisible();

  // 4. CSV(テキスト貼り付け)で生徒登録
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: "1年1組" });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill("1,生徒A");
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText("1件の生徒を登録しました")).toBeVisible();

  // 5. 時間割マスタ設定(起算日は月曜日を指定)
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByLabel("起算日").fill("2026-04-06");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

  // 6. 週次時間割からマスを開き、「この授業を記録する」で授業記録画面へ
  await page.goto("/timetable/weekly");
  await page.getByLabel("週を指定").fill("2026-04-06");
  await page.getByRole("gridcell").filter({ hasText: "国語" }).click();
  await page.getByRole("button", { name: "この授業を記録する" }).click();
  await expect(page).toHaveURL(/\/memos\/record\?date=2026-04-06&period=1/);

  // 7. 授業記録でメモを保存(共有する、初期値のまま)
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill("積極的に発言し、理解も深まっていました。");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();

  // 8. 所見画面で直接呼び出しにより所見を生成・保存(design.mdの方針通りAI呼び出しはモック)
  await page.goto("/settings/ai-provider");
  await page.getByLabel("APIキー").fill("sk-test-golden-path-key");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

  await page.route("**/api/comments/generate", async (route) => {
    await route.fulfill({
      json: { rawText: "授業に積極的に取り組み、着実に成長が見られました。" },
    });
  });

  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: "1年1組" });
  await page.getByRole("link", { name: "生徒Aの所見" }).click();
  await expect(page).toHaveURL(/\/comments\/class\//);

  await page.getByLabel("開始日").fill("2026-04-01");
  await page.getByLabel("終了日").fill("2026-04-30");

  const row = page.getByRole("group", { name: "生徒Aの行" });
  await row.getByRole("button", { name: "AIで生成する" }).click();
  await row.getByRole("button", { name: "生成して所見欄に反映" }).click();
  await expect(row.getByLabel("生徒Aの所見")).toHaveValue(
    "授業に積極的に取り組み、着実に成長が見られました。",
  );

  await row.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("生徒Aの所見を保存しました")).toBeVisible();

  // 保存後、作成方法バッジに反映されていることを確認して一連の流れを締める
  await expect(row.getByText("AI生成(直接呼び出し)")).toBeVisible();
});
