import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** UIがまだ存在しない機能(授業記録)のデータを準備するため、service_role経由で直接1件メモを作る */
async function seedOneMemoDirectly(
  request: APIRequestContext,
  params: { teacherEmail: string; className: string; studentName: string; subjectName: string },
): Promise<void> {
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };

  const usersRes = await request.get(`${SUPABASE_URL}/auth/v1/admin/users`, { headers });
  const usersBody = await usersRes.json();
  const teacherId = usersBody.users.find(
    (u: { email: string; id: string }) => u.email === params.teacherEmail,
  ).id;

  const classRes = await request.get(
    `${SUPABASE_URL}/rest/v1/class?teacher_id=eq.${teacherId}&display_name=eq.${encodeURIComponent(params.className)}&select=id`,
    { headers },
  );
  const classId = (await classRes.json())[0].id;

  const subjectRes = await request.get(
    `${SUPABASE_URL}/rest/v1/subject?teacher_id=eq.${teacherId}&name=eq.${encodeURIComponent(params.subjectName)}&select=id`,
    { headers },
  );
  const subjectId = (await subjectRes.json())[0].id;

  const studentInsertRes = await request.post(`${SUPABASE_URL}/rest/v1/student`, {
    headers: { ...headers, Prefer: "return=representation" },
    data: { class_id: classId, attendance_number: 1, name: params.studentName },
  });
  const studentId = (await studentInsertRes.json())[0].id;

  await request.post(`${SUPABASE_URL}/rest/v1/memo`, {
    headers,
    data: {
      student_id: studentId,
      subject_id: subjectId,
      note_date: "2026-04-10",
      period: 1,
      content: "テスト用メモ",
    },
  });
}

async function signUpAndLogin(page: Page): Promise<string> {
  const email = `e2e-timetable-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("password123");
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);
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

const WEEKDAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

/** 30マス分のCSVテキストを組み立てる(テスト用)。bulkモードは3列、per-classモードは4列 */
function build30RowCsv(
  mode: "bulk" | "per-class",
  subjectName: string,
  className?: string,
): string {
  const header = mode === "bulk" ? "曜日,時限,科目名" : "曜日,時限,科目名,クラス名";
  const rows: string[] = [header];
  for (const weekday of WEEKDAYS) {
    for (const period of PERIODS) {
      rows.push(
        mode === "bulk"
          ? `${weekday},${period},${subjectName}`
          : `${weekday},${period},${subjectName},${className}`,
      );
    }
  }
  return rows.join("\n");
}

/** 時間割表グリッド形式(曜日5列×時限6行、科目名のみ、ヘッダー行なし)のテスト用テキストを組み立てる */
function build30CellGrid(subjectName: string): string {
  return PERIODS.map(() => WEEKDAYS.map(() => subjectName).join("\t")).join("\n");
}

async function importCsvViaPaste(page: Page, csvText: string): Promise<void> {
  await page.getByRole("button", { name: "CSV/貼り付けで取り込む" }).click();
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/曜日,時限,科目名/).fill(csvText);
  await page.getByRole("button", { name: "取り込む", exact: true }).click();
}

test.describe("時間割マスタ設定画面(T-058, T-059, T-060)", () => {
  test("一括モード: クラス選択+マスごとの科目選択で全マスタが保存される", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("月曜1限の科目")).toHaveValue(/./);
    await expect(page.getByLabel("起算日")).toHaveValue("2026-04-06");
  });

  test("教科担任制モード: マスごとに異なる科目・クラスが個別に保存され、モード切替では既存データが変化しない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "2", "2年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");

    await page.goto("/timetable/master");
    await page.getByRole("radio", { name: "教科担任制モード" }).click();

    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByLabel("月曜1限のクラス").selectOption({ label: "1年1組" });
    await page.getByLabel("火曜2限の科目").selectOption({ label: "算数" });
    await page.getByLabel("火曜2限のクラス").selectOption({ label: "2年1組" });
    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    // 一括モードに切り替えても保存済みデータ自体は変化しない(保存するまでは)
    await page.getByRole("radio", { name: "一括モード" }).click();
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await expect(page.getByLabel("月曜1限のクラス")).toHaveValue(/./);
  });

  test("教科担任制モードで登録したユーザーが再度開くと、教科担任制モードのまま表示される(`docs/bugs.md` BUG-004再発防止)", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "2", "2年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");

    await page.goto("/timetable/master");
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByLabel("月曜1限のクラス").selectOption({ label: "1年1組" });
    await page.getByLabel("火曜2限の科目").selectOption({ label: "算数" });
    await page.getByLabel("火曜2限のクラス").selectOption({ label: "2年1組" });
    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    // ページを再読み込みして改めて開くと、保存済みデータ(マスごとに異なるクラス)から
    // 教科担任制モードだったと判断され、一括モードにリセットされずそのまま表示される
    await page.reload();
    await expect(page.getByRole("radio", { name: "教科担任制モード", checked: true })).toBeVisible();
    await expect(page.getByLabel("月曜1限のクラス").locator("option:checked")).toHaveText("1年1組");
    await expect(page.getByLabel("火曜2限のクラス").locator("option:checked")).toHaveText("2年1組");
  });

  test("一括モードで保存すると、既存のマスごとのクラス設定と異なる場合は上書き確認ダイアログが表示される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createClass(page, "2", "2年1組");
    await createSubject(page, "国語");
    await createSubject(page, "算数");

    await page.goto("/timetable/master");
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await page.getByLabel("月曜1限の科目").selectOption({ label: "国語" });
    await page.getByLabel("月曜1限のクラス").selectOption({ label: "1年1組" });
    await page.getByLabel("火曜2限の科目").selectOption({ label: "算数" });
    await page.getByLabel("火曜2限のクラス").selectOption({ label: "2年1組" });
    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    // 一括モードに切り替え、既存と異なるクラスに統一しようとする
    await page.getByRole("radio", { name: "一括モード" }).click();
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByRole("heading", { name: "マスごとのクラス設定を統一しますか" })).toBeVisible();
    await expect(
      page.getByText("保存すると、マスごとに設定されているクラスがすべて選択したクラスに統一されます。続行しますか。"),
    ).toBeVisible();

    await page.getByRole("button", { name: "続行" }).click();
    await expect(page.getByText("時間割マスタを保存しました").last()).toBeVisible();

    // 火曜2限のクラスも1年1組に統一されたことを確認する
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await expect(page.getByLabel("火曜2限のクラス").locator("option:checked")).toHaveText("1年1組");
  });

  test("起算日未入力での保存はエラーになる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("起算日を入力してください")).toBeVisible();
  });

  test("メモ保存後は起算日が読み取り専用になり、「年度を更新する」経由でのみ再設定できる", async ({
    page,
    request,
  }) => {
    const email = await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    await seedOneMemoDirectly(request, {
      teacherEmail: email,
      className: "1年1組",
      studentName: "生徒A",
      subjectName: "国語",
    });

    await page.reload();
    await expect(page.getByLabel("起算日")).toBeDisabled();
    await expect(page.getByText("授業記録が開始されているため起算日は変更できません")).toBeVisible();

    await page.getByRole("button", { name: "年度を更新する" }).click();
    await expect(page.getByRole("heading", { name: "年度を更新しますか" })).toBeVisible();
    await page.getByRole("button", { name: "続行" }).click();

    await expect(page.getByLabel("起算日")).toBeEnabled();
    await page.getByLabel("起算日").fill("2027-04-05");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("起算日")).toHaveValue("2027-04-05");
  });

  test("CSV取り込み(一括モード): 30マス分の3列CSVを貼り付けると全マスが反映され保存できる", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await importCsvViaPaste(page, build30RowCsv("bulk", "国語"));

    await expect(page.getByText("時間割マスタの取り込みが完了しました")).toBeVisible();
    await expect(page.getByLabel("月曜1限の科目").locator("option:checked")).toHaveText("国語");
    await expect(page.getByLabel("金曜6限の科目").locator("option:checked")).toHaveText("国語");

    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
  });

  test("CSV取り込み(教科担任制モード): 30マス分の4列CSVを貼り付けると科目・クラスが両方反映される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByRole("radio", { name: "教科担任制モード" }).click();
    await importCsvViaPaste(page, build30RowCsv("per-class", "国語", "1年1組"));

    await expect(page.getByText("時間割マスタの取り込みが完了しました")).toBeVisible();
    await expect(page.getByLabel("月曜1限の科目").locator("option:checked")).toHaveText("国語");
    await expect(page.getByLabel("月曜1限のクラス").locator("option:checked")).toHaveText("1年1組");
  });

  test("CSV取り込み: 科目名が登録済み科目と一致しない場合はエラーになりグリッドは変更されない", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    // 30行中1行だけ科目名を不正にする(残り29行は正しい「国語」)
    const rows = build30RowCsv("bulk", "国語").split("\n");
    rows[1] = rows[1].replace("国語", "存在しない科目");
    await importCsvViaPaste(page, rows.join("\n"));

    await expect(page.getByText("1件のエラーがあります")).toBeVisible();
    await expect(page.getByText(/科目名が登録済みの科目と一致しません/)).toBeVisible();
    // エラー時はグリッドに反映されない(未設定のまま)
    await expect(page.getByLabel("月曜1限の科目")).toHaveValue("");
  });

  test("CSV取り込み(一括モード): 時間割表をそのまま貼り付けても(曜日5列×時限6行、科目名のみ)全マスが反映される", async ({
    page,
  }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });
    await importCsvViaPaste(page, build30CellGrid("国語"));

    await expect(page.getByText("時間割マスタの取り込みが完了しました")).toBeVisible();
    await expect(page.getByLabel("月曜1限の科目").locator("option:checked")).toHaveText("国語");
    await expect(page.getByLabel("金曜6限の科目").locator("option:checked")).toHaveText("国語");

    await page.getByLabel("起算日").fill("2026-04-06");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();
  });

  test("CSV取り込み: 30マスに満たないデータはINCOMPLETEエラーになる", async ({ page }) => {
    await signUpAndLogin(page);
    await createClass(page, "1", "1年1組");
    await createSubject(page, "国語");

    await page.goto("/timetable/master");
    await page.getByLabel("クラス(全マスに適用)").selectOption({ label: "1年1組" });

    const incompleteCsv = "曜日,時限,科目名\n月,1,国語";
    await importCsvViaPaste(page, incompleteCsv);

    await expect(page.getByText("30マス(曜日5日×時限6)分のデータが必要です")).toBeVisible();
  });
});
