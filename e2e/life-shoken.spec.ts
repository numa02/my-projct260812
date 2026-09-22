import { test, expect, type Page } from "@playwright/test";

async function signUpAndLogin(page: Page): Promise<void> {
  const email = `e2e-life-${crypto.randomUUID()}@example.com`;
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

/** 一括モード(担任クラスのみ)で月曜1限に国語を設定する */
async function setUpSingleClassMaster(page: Page): Promise<void> {
  await page.goto("/timetable/master");
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
  await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
}

/** 一括モード・担任クラス1つ・生徒Aありの共通の下準備 */
async function setUpSingleClass(page: Page): Promise<void> {
  await signUpAndLogin(page);
  await createClass(page, "1", "1年1組");
  await createSubject(page, "国語");
  await importStudents(page, "1年1組", "1,生徒A");
  await setUpSingleClassMaster(page);
}

async function recordLifeMemo(page: Page, dateISO: string, content: string): Promise<void> {
  await page.goto(`/memos/life?date=${dateISO}`);
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill(content);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();
}

async function recordLessonMemo(page: Page, dateISO: string, content: string): Promise<void> {
  await page.goto(`/memos/record?date=${dateISO}&period=1`);
  await page.getByRole("button", { name: /生徒A/ }).click();
  await page.getByLabel("メモ", { exact: true }).fill(content);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました")).toBeVisible();
}

async function openLifeCommentsTab(page: Page) {
  await page.goto("/comments/class");
  await openPeriod(page, "2026-04-01", "2026-04-30");
  await page.getByRole("radio", { name: "生活の所見" }).click();
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

test.describe("生活所見の記録(LS-)", () => {
  test("週次時間割の「生活」マスから、その日付・担任クラスの生活記録画面を開いて生活メモを保存でき、「戻る」で戻れる", async ({
    page,
  }) => {
    await setUpSingleClass(page);

    await page.goto("/timetable/weekly");
    await page.getByLabel("週を指定").fill("2026-04-06");
    await page.getByRole("gridcell", { name: "月曜の生活記録" }).click();

    await expect(page).toHaveURL(/\/memos\/life\?date=2026-04-06&from=\/timetable\/weekly/);
    await expect(page.getByRole("heading", { name: "生活記録" })).toBeVisible();
    await expect(page.getByLabel("日付")).toHaveValue("2026-04-06");
    // その日のクラスが1つだけ(担任クラス)なので、選択欄は出ずに自動で決まる
    await expect(page.getByLabel("クラス")).toHaveCount(0);
    await expect(page.getByText("1年1組", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /生徒A/ }).click();
    await page.getByLabel("メモ", { exact: true }).fill("休み時間に下級生の面倒を見ていた");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("メモを保存しました")).toBeVisible();
    await expect(page.getByText("入力済み")).toBeVisible();

    await page.getByRole("button", { name: "戻る" }).click();
    await expect(page).toHaveURL(/\/timetable\/weekly$/);
  });

  test("その日の時間割に2つ以上のクラスがある(教科担任制)場合はクラス選択欄が出て、選んだクラスの生徒が表示される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "1", "1年2組");
    await createSubject(page, "国語");
    await importStudents(page, "1年1組", "1,生徒A");
    await importStudents(page, "1年2組", "1,生徒B");

    await page.goto("/timetable/master");
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByLabel("月曜1限のクラス").selectOption({ label: "1年1組" });
    await page.getByLabel("月曜2限の科目").selectOption({ label: "国語" });
    await page.getByLabel("月曜2限のクラス").selectOption({ label: "1年2組" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    await page.goto("/memos/life?date=2026-04-06");
    await expect(page.getByLabel("クラス").locator("option")).toHaveText(["1年1組", "1年2組"]);
    await expect(page.getByRole("button", { name: /生徒A/ })).toBeVisible();

    await page.getByLabel("クラス").selectOption({ label: "1年2組" });
    await expect(page.getByRole("button", { name: /生徒B/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /生徒A/ })).toHaveCount(0);
  });

  test("生徒別メモ一覧から日付を選んで生活メモを追加でき、「生活」として表示される。同じ日付の2件目はエラーになる", async ({
    page,
  }) => {
    await setUpSingleClass(page);
    await recordLessonMemo(page, "2026-04-06", "音読が上手だった");

    await page.goto("/memos/students");
    await page.getByLabel("生徒").selectOption({ label: "生徒A" });

    await page.getByRole("button", { name: "生活メモを追加" }).click();
    await page.getByLabel("日付").fill("2026-04-08");
    await page.getByLabel("生活メモ", { exact: true }).fill("給食の配膳を率先して手伝った");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("生活メモを追加しました")).toBeVisible();

    await expect(page.getByText("2026-04-08 ・ 生活記録")).toBeVisible();
    await expect(page.getByText("給食の配膳を率先して手伝った")).toBeVisible();
    await expect(page.getByText("2026-04-06 ・ 1限 ・ 国語")).toBeVisible();

    // 教科別表示では「生活記録」が1つのグループになる(教科「生活」とは別グループ)
    await page.getByRole("radio", { name: "教科別" }).click();
    await expect(page.getByRole("heading", { name: "生活記録" })).toBeVisible();

    await page.getByRole("button", { name: "生活メモを追加" }).click();
    await page.getByLabel("日付").fill("2026-04-08");
    await page.getByLabel("生活メモ", { exact: true }).fill("2件目");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(
      page.getByText("この日付の生活メモは既にあります。一覧から編集してください"),
    ).toBeVisible();
    // 入力内容は保持される
    await expect(page.getByLabel("生活メモ", { exact: true })).toHaveValue("2件目");
  });

  test("生活の所見タブでは生活メモだけがプロンプトの材料になり、保存した内容は学習の所見とは別に保持される", async ({
    page,
  }) => {
    await setUpSingleClass(page);
    await recordLessonMemo(page, "2026-04-06", "授業メモの内容");
    await recordLifeMemo(page, "2026-04-06", "生活メモの内容");

    const row = await openLifeCommentsTab(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();
    // APIキー未設定のため、既定でプロンプトコピー運用になる
    await expect(row.getByLabel("プロンプト")).toHaveValue(/- 2026-04-06: 生活メモの内容/);
    await expect(row.getByLabel("プロンプト")).not.toHaveValue(/授業メモの内容/);

    await row.getByLabel("生徒Aの生活の所見").fill("生活面の所見です。");
    await row.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("生徒Aの生活の所見を保存しました")).toBeVisible();

    await page.getByRole("radio", { name: "学習の所見" }).click();
    await expect(
      page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの所見"),
    ).toHaveValue("");

    await page.reload();
    await page.getByRole("radio", { name: "生活の所見" }).click();
    await expect(
      page.getByRole("group", { name: "生徒Aの行" }).getByLabel("生徒Aの生活の所見"),
    ).toHaveValue("生活面の所見です。");
  });

  test("生活の所見用のひな形を保存すると生活の所見のプロンプトに反映され、学習の所見用のひな形は変わらない", async ({
    page,
  }) => {
    await setUpSingleClass(page);
    await recordLifeMemo(page, "2026-04-06", "生活メモの内容");

    await page.goto("/settings/prompt-template");
    await expect(page.getByLabel("生活の所見用のひな形", { exact: true })).toHaveValue(
      /質の高い生活所見を作成します/,
    );
    await page
      .getByLabel("生活の所見用のひな形", { exact: true })
      .fill("生活用マーカー: {{pseudonymCode}} / {{memos}}");
    await page.getByRole("button", { name: "生活の所見用のひな形を保存" }).click();
    await expect(page.getByText("生活の所見用のひな形を保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("生活の所見用のひな形", { exact: true })).toHaveValue(
      /生活用マーカー/,
    );
    await expect(page.getByLabel("学習の所見用のひな形", { exact: true })).toHaveValue(
      /質の高い学習所見を作成します/,
    );

    const row = await openLifeCommentsTab(page);
    await row.getByRole("button", { name: "AIで生成する" }).click();
    await expect(row.getByLabel("プロンプト")).toHaveValue(/生活用マーカー/);
  });
});
