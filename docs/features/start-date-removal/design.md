# 設計: 起算日の廃止

要件は`docs/features/start-date-removal/requirements.md`を参照。

## データモデルの変更(2フェーズ方式)

`teacher_profile.start_date`列とRPC`update_timetable_start_date`の削除は破壊的変更のため、`.claude/skills/feature-change/SKILL.md`「破壊的DBスキーマ変更は2フェーズ」に従って分割する。

### フェーズ1(本PR・マイグレーションなし)

- アプリから`teacher_profile.start_date`の読み書きと`update_timetable_start_date`の呼び出しをすべて削除する
- DBは変更しない。`start_date`は元々NULL許容のため、新コードが値を書かなくても制約違反は起きない。旧コードが稼働中の時間帯に旧コードが列・RPCを使っても問題ない

### フェーズ2(別PR・本番で数日の安定稼働を確認してから)

新規マイグレーションで以下を行う。

```sql
drop function update_timetable_start_date(date, boolean);
alter table teacher_profile drop column start_date;
```

適用前チェック(SKILL.md §4):

- `start_date`・`update_timetable_start_date`をリポジトリ全体で`git grep`し、RPC定義(`export_teacher_data`等)・テストのフィクスチャに参照が残っていないこと(フェーズ1時点の調査では、SQL上の参照は`teacher_profile`定義と`update_timetable_start_date`のみ)
- `tests/db/rpc-timetable.test.ts`の`update_timetable_start_date`のdescribeブロック、`tests/db/schema.test.ts`の`start_date`参照を同じPRで削除する
- ローカルで`npx supabase db reset`→`npm run test:db`が通ること
- 本番の`teacher_profile`をバックアップしてから適用する

## API設計

- Hono: 変更なし
- RPC: フェーズ1ではフロントからの`update_timetable_start_date`呼び出しを削除するのみ。関数自体はフェーズ2で削除
- 直接Supabaseアクセス: `teacher_profile`の`select("start_date")`を削除(`hooks/useTeacherProfile.ts`ごと削除。他に利用箇所なし)

## 画面/UI設計

### 時間割マスタ設定画面(`app/(main)/timetable/master/`)

- 起算日の`Input`、未入力時のエラー、読み取り専用時の説明文、「年度を更新する」ボタン、年度更新の`ConfirmDialog`を削除
- `useTimetableMaster`から`startDate`・`hasAnyMemo`(起算日ロック判定専用だったメモ件数クエリ)・`updateStartDate`を削除
- 保存処理は`save_timetable_master`のみを呼ぶ

### 週次時間割画面(`app/(main)/timetable/weekly/`)

- `page.tsx`の起算日取得・未設定時の`EmptyState`を削除し、常に`WeeklyTimetableView`を表示
- 見出しを「第N週 yyyy年M月d日(月)〜M月d日(金)」から「yyyy年M月d日(月)〜M月d日(金)」に変更
- 初期表示週(今日を含む週)・週送り・「今週」・週指定の挙動は変更しない

### 共有ロジック

- `shared/week.ts`の`computeWeekNumber`と単体テストを削除(他に利用箇所なし)

## エラーハンドリング

`START_DATE_LOCKED`エラーはフロントから発生しなくなる(RPCを呼ばないため)。それ以外は変更なし。

## 影響を受ける既存テスト

- 単体: `shared/week.test.ts`(`computeWeekNumber`のテスト5件を削除)
- E2E:
  - `timetable-master.spec.ts`: 起算日入力行・保存後の起算日確認を削除。「起算日未入力での保存はエラーになる」「メモ保存後は起算日が読み取り専用…」の2テストを削除(不要になった`seedOneMemoDirectly`ヘルパーも削除)
  - `timetable-weekly.spec.ts`: 「起算日が未設定の場合は参照不可」を「サインアップ直後でも今週の週次時間割を表示できる」に置き換え。週番号のアサーションを日付範囲のアサーションに置き換え
  - `comments-class`・`golden-path`・`memos-record`・`memos-students`・`settings-prompt-template`: 下準備の`setUpMaster`から起算日入力を削除
- DB: フェーズ1では変更なし(`tests/db/rpc-timetable.test.ts`・`tests/db/schema.test.ts`はフェーズ2で追従)

## ロールバック手順

- フェーズ1: PRをrevertするのみ。DB変更がないため、旧コードに戻せば起算日の設定・週番号表示がそのまま復活する(フェーズ1の期間中に新規登録した教員は起算日未設定のため、旧コードでは週次時間割画面で起算日の設定を求められる)
- フェーズ2適用後: 列を削除した時点で保存済みの起算日は失われる。旧コードに戻すには列とRPCを再作成するマイグレーションが必要で、起算日の値はバックアップから復元する
