import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 使い方説明書(docs/manual/index.html)に載せるキャプチャを撮り直すスクリプト。
 *
 *   npx playwright test --config docs/manual/capture/playwright.manual.config.ts
 *
 * 実行するたびにローカルのSupabaseへ新しい教員アカウントを1つ作り、説明書の題材
 * (小学校の学級担任・3年2組)を一通り登録しながら画面を撮る。本番環境には一切触れない。
 *
 * 画像に赤枠や番号は焼き込まず、注釈を付けたい要素の位置だけを images/annotations.json に
 * 書き出す。説明書側はその座標(画像に対する%)を使ってCSSで重ねるため、画面が変わっても
 * 撮り直すだけで注釈の位置が追従する。
 */

// 画像はアプリから配信する場所に直接書き出す(Artifactへもここから公開する)
const IMAGE_DIR = path.resolve(__dirname, "../../../public/manual/images");
const ANNOTATION_PATH = path.resolve(__dirname, "annotations.json");
const WEEK_MONDAY = "2026-09-21";
const CLASS_NAME = "3年2組";

interface MarkOutput {
  n: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
interface ShotOutput {
  name: string;
  width: number;
  height: number;
  marks: MarkOutput[];
}

const shots: ShotOutput[] = [];

/** 番号バッジ付きで注釈したい要素。nは説明書の手順番号と対応させる */
interface Mark {
  n: number;
  target: Locator;
  /** 枠を要素より少し広げたいときの余白(px) */
  pad?: number;
}

/** 開発サーバーでだけ表示される開発者向けバッジ。本番の画面には出ないので撮影時は隠す */
const HIDE_DEV_OVERLAYS = `
  nextjs-portal,
  [data-nextjs-dev-tools-button],
  [class*="tsqd-"] { display: none !important; }
`;

async function shot(page: Page, name: string, marks: Mark[] = []): Promise<void> {
  // トーストのフェードなど、直前の操作のアニメーションが収まるのを待つ
  await page.waitForTimeout(400);
  await page.addStyleTag({ content: HIDE_DEV_OVERLAYS });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewportSize が取得できませんでした");

  const resolved: MarkOutput[] = [];
  for (const mark of marks) {
    const box = await mark.target.boundingBox();
    if (!box) throw new Error(`注釈対象が画面上に見つかりません: ${name} の ${mark.n}`);
    const pad = mark.pad ?? 6;
    resolved.push({
      n: mark.n,
      left: ((box.x - pad) / viewport.width) * 100,
      top: ((box.y - pad) / viewport.height) * 100,
      width: ((box.width + pad * 2) / viewport.width) * 100,
      height: ((box.height + pad * 2) / viewport.height) * 100,
    });
  }

  await page.screenshot({ path: path.join(IMAGE_DIR, `${name}.png`) });
  shots.push({ name, width: viewport.width, height: viewport.height, marks: resolved });
}

const STUDENTS = [
  "青木 陽菜",
  "東 蓮",
  "飯田 結衣",
  "井上 颯太",
  "上原 美咲",
  "遠藤 悠真",
  "大野 さくら",
  "岡田 陽向",
  "加藤 一花",
  "川口 大翔",
  "木村 心春",
  "小林 湊",
  "齋藤 莉子",
  "坂本 陽斗",
  "佐々木 芽依",
  "清水 律",
  "鈴木 葵",
  "高橋 蒼空",
  "田中 凛",
  "谷口 悠斗",
  "中村 咲良",
  "西村 海斗",
  "橋本 杏",
  "原田 樹",
  "平野 花音",
  "藤井 朝陽",
  "松本 結菜",
  "山下 新",
];

const STUDENT_PASTE = STUDENTS.map((name, i) => `${i + 1},${name}`).join("\n");

/** 月〜金 × 1〜6限。科目名は標準科目セット(小学校)に含まれるものだけを使う */
const TIMETABLE_PASTE = [
  ["国語", "算数", "国語", "算数", "国語"],
  ["算数", "国語", "算数", "国語", "社会"],
  ["理科", "体育", "社会", "理科", "算数"],
  ["社会", "音楽", "理科", "英語", "体育"],
  ["体育", "図画工作", "総合", "音楽", "総合"],
  ["学活", "図画工作", "学活", "総合", "学活"],
]
  .map((row) => row.join("\t"))
  .join("\n");

/** 説明書の画面例に厚みを出すための授業メモ。時間割の配置と矛盾しない組み合わせにする */
const SEED_MEMOS: { date: string; period: number; entries: { student: string; text: string }[] }[] =
  [
    {
      date: "2026-09-21",
      period: 3,
      entries: [
        {
          student: "青木 陽菜",
          text: "日なたと日かげの地面の温度を、時間を決めて記録していた。表に書き込む手際がよい。",
        },
        {
          student: "高橋 蒼空",
          text: "温度計の目盛りの読み方を友だちに教えていた。",
        },
      ],
    },
    {
      date: "2026-09-21",
      period: 4,
      entries: [
        {
          student: "青木 陽菜",
          text: "スーパーマーケット見学のメモをもとに、お店の工夫を3つ挙げて発表した。",
        },
      ],
    },
    {
      date: "2026-09-22",
      period: 1,
      entries: [
        {
          student: "青木 陽菜",
          text: "あまりのあるわり算で、図に描いて考え方を説明できた。",
        },
        {
          student: "井上 颯太",
          text: "計算の手順を式で説明し、友だちの質問にも落ち着いて答えていた。",
        },
        {
          student: "加藤 一花",
          text: "答えの確かめ算を自分から行っていた。",
        },
      ],
    },
  ];

test("使い方説明書のキャプチャを撮影する", async ({ page }) => {
  mkdirSync(IMAGE_DIR, { recursive: true });

  // ---------------------------------------------------------------- 認証
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  await page.getByLabel("メールアドレス").fill("sakura.tanaka@example.ed.jp");
  await page.getByLabel("パスワード").fill("password123");
  await shot(page, "01-login", [
    { n: 1, target: page.getByLabel("メールアドレス") },
    { n: 2, target: page.getByLabel("パスワード") },
    { n: 3, target: page.getByRole("button", { name: "ログイン" }) },
  ]);

  await page.goto("/signup");
  // 画面例には読みやすいアドレスを写し、実際の登録には衝突しない一意のアドレスを使う
  const email = `manual-demo-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("メールアドレス").fill("sakura.tanaka@example.ed.jp");
  await page.getByLabel("パスワード").fill("password123");
  // 学校区分を選んでおくと標準科目が自動で登録される。説明書ではこの経路を推奨している
  await page.getByLabel("学校区分(任意)").selectOption({ label: "小学校" });
  await shot(page, "02-signup", [
    { n: 1, target: page.getByLabel("メールアドレス") },
    { n: 2, target: page.getByLabel("パスワード") },
    { n: 3, target: page.getByLabel("学校区分(任意)") },
    { n: 4, target: page.getByRole("button", { name: "サインアップ" }) },
  ]);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/classes$/);

  // サイドバー単体(説明書の「画面の見取り図」用)
  await shot(page, "03-nav", []);

  // ---------------------------------------------------------------- 科目
  await page.goto("/subjects");
  // サインアップ時の学校区分の指定で、標準科目が既に入っている
  await expect(page.getByText("国語", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "標準科目セットを追加" }).click();
  await shot(page, "04-subjects-seed", [
    { n: 1, target: page.getByRole("button", { name: "標準科目セットを追加" }) },
    { n: 2, target: page.getByLabel("学校区分") },
    { n: 3, target: page.getByRole("button", { name: "追加する" }) },
  ]);
  await page.getByRole("button", { name: "標準科目セットを追加" }).click();
  await shot(page, "05-subjects-list", [
    { n: 1, target: page.getByLabel("科目名") },
    { n: 2, target: page.getByRole("button", { name: "登録", exact: true }) },
  ]);

  // ---------------------------------------------------------------- クラス
  await page.goto("/classes");
  await expect(page.getByText("まだクラスがありません")).toBeVisible();
  await shot(page, "06-classes-empty", [
    { n: 1, target: page.getByRole("button", { name: "クラスを作成" }) },
  ]);

  await page.getByRole("button", { name: "クラスを作成" }).click();
  await page.getByLabel("学年").fill("3");
  await page.getByLabel("クラス表示名").fill(CLASS_NAME);
  await shot(page, "07-classes-create", [
    { n: 1, target: page.getByLabel("学年") },
    { n: 2, target: page.getByLabel("クラス表示名") },
    { n: 3, target: page.getByRole("button", { name: "保存" }) },
  ]);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("クラスを作成しました")).toBeVisible();
  await shot(page, "08-classes-list", []);

  // ---------------------------------------------------------------- 生徒
  await page.goto("/students");
  await page.getByLabel("クラス").selectOption({ label: CLASS_NAME });
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/出席番号,氏名/).fill(STUDENT_PASTE);
  await shot(page, "09-students-paste", [
    { n: 1, target: page.getByLabel("クラス") },
    { n: 2, target: page.getByRole("radio", { name: "テキスト貼り付け" }) },
    { n: 3, target: page.getByLabel(/出席番号,氏名/) },
    { n: 4, target: page.getByRole("button", { name: "取り込む" }) },
  ]);
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByText(`${STUDENTS.length}件の生徒を登録しました`)).toBeVisible();
  await shot(page, "10-students-list", []);

  // ---------------------------------------------------------------- 時間割マスタ
  await page.goto("/timetable/master");
  await page.getByRole("radio", { name: "一括モード" }).click();
  await page.getByRole("button", { name: "CSV/貼り付けで取り込む" }).click();
  await page.getByRole("radio", { name: "テキスト貼り付け" }).click();
  await page.getByLabel(/時間割表|曜日,時限,科目名/).fill(TIMETABLE_PASTE);
  await shot(page, "11-master-paste", [
    { n: 1, target: page.getByLabel("時間割入力モード") },
    { n: 2, target: page.getByLabel(/時間割表|曜日,時限,科目名/) },
    { n: 3, target: page.getByRole("button", { name: "取り込む", exact: true }) },
  ]);
  await page.getByRole("button", { name: "取り込む", exact: true }).click();
  await page.getByLabel("クラス(全マスに適用)").selectOption({ label: CLASS_NAME });
  await shot(page, "12-master-grid", [
    { n: 1, target: page.getByLabel("クラス(全マスに適用)") },
    { n: 2, target: page.getByLabel("月曜1限の科目") },
    { n: 3, target: page.getByRole("button", { name: "保存" }) },
  ]);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("時間割マスタを保存しました")).toBeVisible();

  // ---------------------------------------------------------------- 週次時間割
  await page.goto("/timetable/weekly");
  await page.getByLabel("週を指定").fill(WEEK_MONDAY);
  await expect(page.getByRole("gridcell").filter({ hasText: "国語" }).first()).toBeVisible();
  await shot(page, "13-weekly", [
    { n: 1, target: page.getByLabel("週を指定") },
    { n: 2, target: page.getByRole("gridcell").filter({ hasText: "理科" }).first() },
  ]);

  await page.getByRole("gridcell").filter({ hasText: "理科" }).first().click();
  await shot(page, "14-weekly-modal", [
    { n: 1, target: page.getByLabel("科目") },
    { n: 2, target: page.getByRole("button", { name: "この授業を記録する" }) },
  ]);
  await page.getByRole("button", { name: "この授業を記録する" }).click();
  await expect(page).toHaveURL(/\/memos\/record/);

  // ---------------------------------------------------------------- 授業記録
  await shot(page, "15-record-list", [
    { n: 1, target: page.getByRole("button", { name: new RegExp(STUDENTS[0]) }) },
  ]);

  await page.getByRole("button", { name: new RegExp(STUDENTS[0]) }).click();
  await page
    .getByLabel("メモ", { exact: true })
    .fill("日なたと日かげの地面の温度を、時間を決めて記録していた。表に書き込む手際がよい。");
  await shot(page, "16-record-expanded", [
    { n: 1, target: page.getByLabel("メモ", { exact: true }) },
    { n: 2, target: page.getByRole("switch", { name: "共有区分" }), pad: 10 },
    { n: 3, target: page.getByRole("button", { name: "保存" }) },
  ]);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メモを保存しました").first()).toBeVisible();
  await page.getByRole("button", { name: new RegExp(STUDENTS[0]) }).click();
  await shot(page, "17-record-saved", [
    { n: 1, target: page.getByText("入力済み").first() },
  ]);

  // 説明書の他の画面を実際の記録で埋めるため、残りのメモも同じ画面から入力する
  for (const seed of SEED_MEMOS) {
    await page.goto(`/memos/record?date=${seed.date}&period=${seed.period}`);
    for (const entry of seed.entries) {
      const row = page.getByRole("button", { name: new RegExp(entry.student) });
      await row.click();
      const textarea = page.getByLabel("メモ", { exact: true });
      if ((await textarea.inputValue()) === "") {
        await textarea.fill(entry.text);
        await page.getByRole("button", { name: "保存" }).click();
        await expect(page.getByText("メモを保存しました").first()).toBeVisible();
      }
      await row.click();
    }
  }

  // ---------------------------------------------------------------- 生活記録
  await page.goto("/timetable/weekly");
  await page.getByLabel("週を指定").fill(WEEK_MONDAY);
  const lifeCell = page.getByRole("gridcell", { name: "火曜の生活記録" });
  await expect(lifeCell).toBeVisible();
  await shot(page, "18-weekly-life-row", [{ n: 1, target: lifeCell }]);
  await lifeCell.click();
  await expect(page).toHaveURL(/\/memos\/life/);

  await page.getByRole("button", { name: new RegExp(STUDENTS[0]) }).click();
  await page
    .getByLabel("メモ", { exact: true })
    .fill("朝の会で、休んだ友だちの当番をすすんで代わっていた。");
  await shot(page, "19-life-record", [
    { n: 1, target: page.getByLabel("日付") },
    { n: 2, target: page.getByLabel("メモ", { exact: true }) },
    { n: 3, target: page.getByRole("button", { name: "保存" }) },
  ]);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(/保存しました/).first()).toBeVisible();

  // ---------------------------------------------------------------- 生徒別メモ一覧
  await page.goto("/memos/students");
  await page.getByLabel("クラス").selectOption({ label: CLASS_NAME });
  // 「選択してください」の次が出席番号1番の生徒
  await page.getByLabel("生徒").selectOption({ index: 1 });
  await expect(page.getByText(/日なたと日かげ/).first()).toBeVisible();
  await shot(page, "20-student-memos", [
    { n: 1, target: page.getByLabel("クラス") },
    { n: 2, target: page.getByLabel("生徒") },
    { n: 3, target: page.getByLabel("表示切替") },
  ]);

  await page.getByRole("radio", { name: "教科別" }).click();
  await shot(page, "21-student-memos-subject", [
    { n: 1, target: page.getByLabel("表示切替") },
  ]);

  // ---------------------------------------------------------------- AIプロバイダ設定
  await page.goto("/settings/ai-provider");
  await page.getByLabel("AIプロバイダ").selectOption("gemini");
  await page.getByLabel("APIキー").fill("AIzaSyDEMO-manual-capture-key");
  await shot(page, "22-ai-provider", [
    { n: 1, target: page.getByLabel("AIプロバイダ") },
    { n: 2, target: page.getByLabel("モデル") },
    { n: 3, target: page.getByLabel("APIキー") },
    { n: 4, target: page.getByRole("button", { name: "保存" }) },
  ]);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("AIプロバイダ設定を保存しました")).toBeVisible();

  // ---------------------------------------------------------------- 所見
  await page.route("**/api/comments/generate", async (route) => {
    await route.fulfill({
      json: {
        rawText:
          "理科では日なたと日かげの地面の温度を時間を決めて記録し、結果を表にまとめることができました。算数のあまりのあるわり算では、図をかいて考え方を友だちに説明する姿が見られました。",
      },
    });
  });

  await page.goto("/comments/class");
  await page.getByLabel("クラス").selectOption({ label: CLASS_NAME });
  await page.getByLabel("開始日").fill("2026-09-01");
  await page.getByLabel("終了日").fill("2026-09-30");
  await expect(
    page.getByText("対象期間(開始日・終了日)を指定すると、このクラスの生徒一覧が表示されます"),
  ).toHaveCount(0);
  await shot(page, "23-comments-list", [
    { n: 1, target: page.getByLabel("所見の種類") },
    { n: 2, target: page.getByLabel("開始日") },
    { n: 3, target: page.getByLabel("終了日") },
  ]);

  const commentRow = page.getByRole("group", { name: `${STUDENTS[0]}の行` });
  await commentRow.getByRole("button", { name: "AIで生成する" }).click();
  await commentRow.getByLabel("目安文字数").fill("120");
  await shot(page, "24-comments-ai", [
    { n: 1, target: page.getByLabel("所見の作成方法") },
    { n: 2, target: commentRow.getByRole("button", { name: "生成して所見欄に反映" }) },
  ]);
  await commentRow.getByRole("button", { name: "生成して所見欄に反映" }).click();
  await expect(commentRow.getByLabel(`${STUDENTS[0]}の所見`)).not.toHaveValue("");
  await shot(page, "25-comments-generated", [
    { n: 1, target: commentRow.getByLabel(`${STUDENTS[0]}の所見`) },
    { n: 2, target: commentRow.getByRole("button", { name: "保存" }) },
  ]);
  await commentRow.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(`${STUDENTS[0]}の所見を保存しました`)).toBeVisible();

  // ---------------------------------------------------------------- 設定まわり
  await page.goto("/settings/prompt-template");
  await expect(page.getByLabel("学習の所見用のひな形", { exact: true })).toBeVisible();
  await shot(page, "26-prompt-template", []);

  await page.goto("/settings/export");
  await expect(page.getByRole("button", { name: "全データをエクスポート" })).toBeVisible();
  await shot(page, "27-export", [
    { n: 1, target: page.getByRole("button", { name: "全データをエクスポート" }) },
  ]);

  writeFileSync(
    ANNOTATION_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), shots }, null, 2)}\n`,
  );
});
