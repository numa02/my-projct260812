# 実装タスク: 起算日の廃止

対応する設計は`docs/features/start-date-removal/design.md`、影響範囲は`docs/features/start-date-removal/impact.md`を参照。

ID接頭辞: `SD-`。`teacher_profile.start_date`列と`update_timetable_start_date`の削除は破壊的変更のため2フェーズに分ける。フェーズ1(SD-001〜SD-007)はマイグレーションを伴わない。フェーズ2(SD-008〜SD-010)は本番でフェーズ1の安定稼働を数日確認してから別PRで行う。

---

## フェーズ1(アプリから起算日を撤去)

- [x] **SD-001** 要件・設計・影響範囲・タスク表を作成する
  - DoD: 本ディレクトリに`requirements.md`・`design.md`・`impact.md`・`tasks.md`が揃い、`docs/features/README.md`の時間割マスタ設定・週次時間割の行にSD-のタスクIDが追記されている
  - 依存: なし
  - ロールバック: ファイル削除のみ

- [x] **SD-002** `shared/week.ts`から`computeWeekNumber`と単体テストを削除する
  - DoD: `computeWeekNumber`の定義・テストが消え、`npm run test`が通る
  - 依存: なし
  - ロールバック: revertのみ

- [x] **SD-003** hooksから起算日の読み書きを削除する
  - DoD: `hooks/useTeacherProfile.ts`を削除し、`useTimetableMaster`から`startDate`・`hasAnyMemo`・`updateStartDate`を削除する。`update_timetable_start_date`を呼ぶコードがリポジトリ内に残っていない。`npx tsc --noEmit`が通る
  - 依存: なし
  - ロールバック: revertのみ(DB変更なし)

- [x] **SD-004** 時間割マスタ設定画面・週次時間割画面から起算日を撤去する
  - DoD: 時間割マスタ設定画面に起算日入力欄・年度更新操作が表示されない。週次時間割画面は時間割マスタ未設定でも開け、見出しは日付範囲のみ(「第N週」なし)。`npm run lint`・`npm run build`が通る
  - 依存: SD-002, SD-003
  - ロールバック: revertのみ

- [x] **SD-005** モックアップを更新する
  - DoD: `mockups/timetable-master.html`から起算日入力欄・起算日ロック状態・起算日未入力エラーの節が消え、`mockups/weekly-timetable.html`の見出しが日付範囲のみになっている
  - 依存: なし
  - ロールバック: revertのみ

- [x] **SD-006** E2Eテストを更新する
  - DoD: `design.md`「影響を受ける既存テスト」のとおり更新し、`npm run test:e2e`が全件通る(59件通過)
  - 依存: SD-004
  - ロールバック: revertのみ

- [x] **SD-007** 全体設計書・画面別テストケースを更新する
  - DoD: `docs/requirements.md`・`docs/data-model.md`・`docs/design.md`・`docs/design/screens.md`・`docs/design/user-flow.md`・`CLAUDE.md`・`docs/features/timetable-master/test-cases.md`・`docs/features/timetable-weekly/test-cases.md`が新仕様に沿っている(`start_date`列・RPCは「廃止予定」と明記)。不要になったテストケースは見出しに【廃止】を付けてIDを残す
  - 依存: なし
  - ロールバック: revertのみ

## フェーズ2(DBから削除。本番でフェーズ1の安定稼働を確認後、別PR)

- [x] **SD-008** 列・RPC削除のマイグレーションを作成する
  - DoD: 新規マイグレーションで`drop function update_timetable_start_date(date, boolean);`と`alter table teacher_profile drop column start_date;`を行う。適用前に`git grep -n "start_date\|update_timetable_start_date"`で、RPC定義・テストのフィクスチャに参照が残っていないことを確認済み。ローカルで`npx supabase db reset`が通る(`supabase/migrations/20260920090000_start_date_contract.sql`)
  - 依存: SD-001〜SD-007が本番反映済みであること(本PRはコード・マイグレーションの準備まで。本番適用は下記SD-010で、フェーズ1の安定稼働を確認してから行う)
  - ロールバック: 列とRPCを再作成するマイグレーションを追加し、起算日の値は本番バックアップから復元する

- [x] **SD-009** DBテストを追従させる
  - DoD: `tests/db/rpc-timetable.test.ts`の`update_timetable_start_date`のdescribeブロックと、`tests/db/schema.test.ts`の`start_date`参照を削除し、`npm run test:db`が通る(45件通過)
  - 依存: SD-008
  - ロールバック: revertのみ

- [ ] **SD-010** 本番に適用する(ユーザーが実行)
  - DoD: フェーズ1(PR #9)が本番で数日安定稼働していることを確認したうえで、本番の`teacher_profile`をバックアップしてから`npx supabase db push`で適用する。適用前に`select column_name from information_schema.columns where table_name = 'teacher_profile';`で`start_date`列の存在を読み取り確認する(読み取りはClaudeが実施可)。全体設計書からの`start_date`・`update_timetable_start_date`の記述削除はSD-008と同じPRで対応済み
  - 依存: SD-008, SD-009
  - ロールバック: SD-008のロールバック手順に従う
