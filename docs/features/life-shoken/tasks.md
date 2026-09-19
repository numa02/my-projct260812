# 実装タスク: 生活所見の記録

対応する設計は`docs/features/life-shoken/design.md`、影響範囲は`docs/features/life-shoken/impact.md`を参照。

ID接頭辞: `LS-`。既存テーブル・既存コードと両立する加算的な変更のみのため、2フェーズ方式・フィーチャーフラグ用のタスクは置かない。

---

- [x] **LS-001** 要件・設計・影響範囲・タスク表・テストケースを作成する
  - DoD: 本ディレクトリに`requirements.md`・`design.md`・`impact.md`・`tasks.md`・`test-cases.md`が揃い、`docs/features/README.md`に1行追加されている
  - 依存: なし
  - ロールバック: ファイル削除のみ

- [x] **LS-002** マイグレーションとDBテストを追加する
  - DoD: `supabase/migrations/20260919120000_life_shoken.sql`で`life_memo`・`student_life_comment`(RLS・ポリシー込み)、`prompt_template.life_content`追加と`content`のnot null解除、`export_teacher_data`の出力追加を行う。`tests/db/rls.test.ts`(他教員のデータを読めない・書けない)・`tests/db/schema.test.ts`(一意制約・ひな形の部分保存)・`tests/db/rpc-export.test.ts`を追加・更新し、`npx supabase db reset`→`npm run test:db`が通る(47件)
  - 依存: LS-001
  - ロールバック: `design.md`「ロールバック手順」を参照

- [x] **LS-003** `shared/`の純粋関数・スキーマを追加する
  - DoD: `prompt-builder.ts`(生活メモの出力形式・生活用既定ひな形)、`life-record.ts`(クラス判定)、`schemas`(`lifeMemoInputSchema`・`commentKindSchema`)とそれぞれの単体テストが追加され、`npm run test`が通る
  - 依存: なし
  - ロールバック: revertのみ

- [x] **LS-004** hooksを追加・拡張する
  - DoD: `useLifeRecord`を新規作成し、`useStudentMemos`(生活メモの統合・追加)・`useStudentComments`/`useSharedMemosForPeriod`(種類の切替)・`usePromptTemplate`(2種類のひな形)を拡張する。`npx tsc --noEmit`が通る
  - 依存: LS-002, LS-003
  - ロールバック: revertのみ

- [x] **LS-005** UIを統合する
  - DoD: 週次時間割の「生活」行、生活記録画面(`app/(main)/memos/life/`)、生徒別メモ一覧の生活メモ表示・追加フォーム、所見管理画面の学習/生活タブ、プロンプトひな形編集画面の2フォームが動作する。`npm run lint`・`npm run build`が通る
  - 依存: LS-004
  - ロールバック: revertのみ(DBに新テーブルが残っても旧コードは動く)

- [x] **LS-006** モックアップを更新する
  - DoD: `mockups/weekly-timetable.html`(生活行)・`student-memo-list.html`(生活メモ・追加フォーム)・`comment.html`(タブ)・`settings.html`(2つのひな形)を更新し、`mockups/life-record.html`を新規作成する
  - 依存: なし
  - ロールバック: revertのみ

- [x] **LS-007** E2Eテストを追加・更新する
  - DoD: `e2e/life-shoken.spec.ts`(生活マス→生活記録・教科担任制のクラス選択・メモ一覧からの追加と重複エラー・生活の所見タブ・生活用ひな形)を追加し、`e2e/settings-prompt-template.spec.ts`をラベル変更に追従させる。`npm run test:e2e`が通る(64件中63件。残り1件`comments-class.spec.ts:288`は全件実行時のみタイムアウトし、単独3回・スペック単位の再実行では通過する既存の不安定テスト)
  - 依存: LS-005
  - ロールバック: revertのみ

- [x] **LS-008** 全体設計書を更新する
  - DoD: `docs/requirements.md`(F14・F15・ユーザーストーリー・用語集)・`docs/data-model.md`・`docs/design.md`(§4.2・§5.2)・`docs/design/screens.md`(画面10-2の追加、画面9・11・12・13)・`docs/design/user-flow.md`が更新されている
  - 依存: なし
  - ロールバック: revertのみ
