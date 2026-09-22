# 設計: 生活所見の記録

要件は`docs/features/life-shoken/requirements.md`を参照。

## データモデルの変更

すべて既存テーブル・既存コードと両立する加算的な変更のため、2フェーズ方式は不要(1マイグレーションで適用する)。

### `life_memo`(新規)

| カラム | 型 | 制約 |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| student_id | uuid | not null, FK student(id) on delete cascade |
| note_date | date | not null |
| content | text | not null |
| share_flag | share_flag | not null, default 'shared' |
| created_at / updated_at | timestamptz | not null, default now() |

- `unique (student_id, note_date)`(1人1日1件)
- RLS: `memo`と同じく`student→class`経由で`class.teacher_id = auth.uid()`のみ許可(`for all using ... with check ...`)

### `student_life_comment`(新規)

`student_comment`(フェーズ2適用後)と同じ構造: `id`, `student_id`(unique, FK cascade), `content`, `target_char_count`, `creation_method`(`comment_creation_method`), `created_at`, `updated_at`。RLSも同じ。

**`student_comment`に種別列を足さない理由**: `student_comment`は`unique (student_id)`で1人1件を保証し、フロントは`onConflict: "student_id"`でupsertしている。種別列を足して一意制約を`(student_id, kind)`に入れ替えると、稼働中の旧コードのupsertが失敗する(制約の入れ替えは破壊的変更)。別テーブルなら既存の制約・コードに一切触れずに済む。

### `prompt_template`(変更)

- `life_content text`(nullable)を追加。nullなら生活の所見用の既定ひな形を使う
- `content`の`not null`を外す。生活用だけを先に保存した教員の行を作れるようにするため(nullなら学習用の既定ひな形を使う。旧コードは`data?.content ?? DEFAULT`で読むためnullでも動く)。NOT NULLの除去は既存コードと両立する

### `export_teacher_data()`(変更)

`create or replace`で、生徒ごとに`lifeMemos`・`lifeComments`、`promptTemplate`に`lifeContent`を追加する。既存キーは変えない。

## API設計

- Hono: 変更なし(`/api/comments/generate`は組み立て済みプロンプトを受け取るだけ)
- 直接Supabaseアクセス: `life_memo`・`student_life_comment`・`prompt_template.life_content`の読み書き
- RPC: `export_teacher_data`の出力追加のみ

## 画面/UI設計

### 週次時間割(`TimetableGrid`・`WeeklyTimetableView`)

- `TimetableGrid`に任意のprop`onLifeCellClick?: (weekday) => void`を追加。指定時のみ6限の下に「生活記録」行(各曜日に「生活記録」ボタン)を表示する。時間割マスタ設定画面では渡さないため表示されない
- 押すと`/memos/life?date=<その日>&from=/timetable/weekly`へ遷移

### 生活記録画面(新規、`app/(main)/memos/life/`)

- 授業記録画面と同じ構成(日付欄・生徒の折りたたみ一覧・`StudentMemoRow`で保存)。時限欄はない
- クラス判定は純粋関数`resolveLifeRecordClassCandidates`(`shared/life-record.ts`)で行う: その日の`resolvedSlots`に登場するクラスが1つならそれに確定(選択欄なし)、2つ以上ならその候補から選択、0なら全クラスから選択
- 保存は`life_memo`へ`upsert(onConflict: "student_id,note_date")`

### 生徒別メモ一覧

- `useStudentMemos`が`memo`と`life_memo`の両方を取得し、`kind: "lesson" | "life"`付きの行に統合して日付降順に並べる(同じ日付では授業メモを時限降順、生活メモはその後)
- 生活メモの表示は「日付 ・ 生活記録」。「教科別」表示では「生活記録」グループ(小学校の教科「生活」の授業メモとは別グループ。`docs/features/ui-clarity/`)
- 「生活メモを追加」ボタンで追加フォーム(日付・メモ・共有区分)を開く。`insert`し、一意制約違反(`23505`)なら既にある旨をフォーム内に表示

### 所見管理画面

- クラス・対象期間の下に`SegmentedControl`(「学習の所見」「生活の所見」)。対象期間は両タブ共通(クラスごとに1つ、従来どおり)
- `StudentCommentRow`・`CommentAiAssist`・`useStudentComments`・`useSharedMemosForPeriod`に`kind: CommentKind`(`"learning" | "life"`)を渡し、参照テーブル・メモ・ひな形を切り替える
- 生活の所見の入力欄のラベルは「(氏名)の生活の所見」(学習の所見は従来どおり「(氏名)の所見」)

### プロンプトひな形編集画面

- 2つのフォーム(学習の所見用・生活の所見用)を縦に並べ、それぞれ保存ボタンを持つ
- `usePromptTemplate`は`content`・`life_content`を1回で取得し、`saveTemplate`/`saveLifeTemplate`を返す。upsertは保存する列だけを送る(PostgRESTのupsertは送らなかった列を上書きしない)

### 共有ロジック(`shared/`)

- `prompt-builder.ts`: `PromptMemo`の`subjectName`・`period`を任意にし、生活メモは「- 日付: 内容」で出力する。`DEFAULT_LIFE_PROMPT_TEMPLATE`を追加
- `life-record.ts`: `resolveLifeRecordClassCandidates`
- `schemas/index.ts`: `commentKindSchema`・`lifeMemoInputSchema`

## エラーハンドリング

- 生活メモ・所見の保存失敗は従来どおり入力内容を保持してエラー表示(F13、自動リトライなし)
- 生徒別メモ一覧からの追加で同日重複の場合は、エラーコード`23505`を判定して専用の文言を表示

## 影響を受ける既存テスト

- `tests/db/rpc-export.test.ts`: 生活メモ・生活の所見・生活用ひな形の出力を追加で検証
- `tests/db/rls.test.ts`: `life_memo`・`student_life_comment`のRLSケースを追加
- `tests/db/schema.test.ts`: `life_memo`の`(student_id, note_date)`一意制約・`student_life_comment`の`(student_id)`一意制約のケースを追加
- `shared/prompt-builder.test.ts`: 生活メモの出力形式を追加
- `components/timetable/TimetableGrid.test.tsx`: 生活行の表示有無を追加
- `e2e/settings-prompt-template.spec.ts`: ひな形の入力欄ラベル変更(「プロンプトひな形」→「学習の所見用のひな形」)に追従
- `e2e/timetable-weekly.spec.ts`・`e2e/memos-students.spec.ts`・`e2e/comments-class.spec.ts`: 生活マス→生活記録、生活メモ追加、生活の所見タブのケースを追加

## ロールバック手順

- コードのみrevertする場合: 新テーブル・新列が残るだけで旧コードは動く(旧コードは新テーブルを参照せず、`prompt_template.content`がnullの行も既定値で読む)
- DBも戻す場合: `drop table student_life_comment; drop table life_memo; alter table prompt_template drop column life_content;`、`export_teacher_data`を旧定義で`create or replace`。`prompt_template.content`がnullの行がある場合は、`not null`を戻す前に既定ひな形で埋めるか行を削除する。生活メモ・生活の所見のデータは失われるため、事前にエクスポートを取得する
