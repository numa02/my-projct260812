# 影響範囲: 単元の記録と単元別の所見生成

## データモデルへの影響

| 対象 | 変更 | 破壊的か |
|---|---|---|
| `unit`(新設) | テーブル追加。`subject_id`必須、`unique (id, subject_id)`、RLSポリシー、`updated_at`トリガー | いいえ(追加のみ) |
| `memo` | `unit_id`列の追加(nullable)と複合外部キー`(unit_id, subject_id) → unit(id, subject_id) on delete set null (unit_id)` | いいえ。既存行はすべて`null`になり、既存の列・制約・RLSポリシーには触れない |
| `subject` | 変更なし。`unit`から`on delete cascade`で参照されるだけ | いいえ |
| `export_teacher_data` | `create or replace`。`subjects[].units`と`memos[].unitId`を追加 | いいえ(既存キーは不変) |

既存の一意制約・NOT NULL・RLSポリシーの入れ替えがないため、**2フェーズ方式(expand/contract)は不要**。マイグレーション適用とVercelデプロイの順序に依存しない(適用後・デプロイ前の旧コードは`unit_id`を読み書きしないため正常に動く)。

## 画面への影響

| 画面 | 影響 |
|---|---|
| 科目管理(`/subjects`) | 科目の行が折りたたみになり、中に単元の一覧・追加・編集・削除と「貼り付けで一括登録」が入る。科目の削除確認の本文に単元も削除されることを追記 |
| 授業記録(`/memos/record`) | 単元のプルダウンを追加。単元を変えるとそのコマの保存済みメモ全件の単元が更新される |
| 生徒別メモ一覧(`/memos/students`) | メモの見出しに単元名を表示。「教科別」表示が教科 → 単元の2段になる |
| 所見管理(`/comments/class`) | AI生成セクションに生成単位の切り替えが増える(学習・総合のみ)。「単元ごとに生成」で単元カードの一覧が出る |
| プロンプトひな形編集(`/settings/prompt-template`) | 案内文に`{{unitName}}`を追記 |
| 週次時間割・生活記録・クラス管理・生徒名簿・AIプロバイダ設定・データエクスポート | 画面の変更なし(エクスポートは出力内容が増えるだけ) |

グローバルナビの項目は増えない。画面遷移も変わらないため`docs/design/user-flow.md`のMermaid図は変更不要。

## コードへの影響

| ファイル | 影響 |
|---|---|
| `supabase/migrations/<timestamp>_memo_unit.sql`(新規) | `unit`新設・`memo.unit_id`追加・`export_teacher_data`更新・`unit`の`updated_at`トリガー |
| `shared/schemas/index.ts` | `unitInputSchema`・`generationScopeSchema`を追加。`memoInputSchema`に`unitId`を追加 |
| `shared/prompt-builder.ts` | `PromptMemo.unitName`を追加。`formatMemoLine`が単元名を含める。`buildPrompt`が`{{unitName}}`を置換。**既定ひな形3種の文面は変更しない** |
| `shared/group-memos-by-unit.ts`(新規) | 所見生成の材料を単元ごとに分ける純粋関数と`UNIT_UNSET_LABEL` |
| `shared/group-memos-by-subject-unit.ts`(新規) | 生徒別メモ一覧の教科 → 単元の2段グループ化の純粋関数 |
| `shared/parse-unit-list.ts`(新規) | 貼り付けテキストから単元名を抽出する純粋関数(1行1単元・先頭列のみ) |
| `hooks/useUnits.ts`(新規) | 科目ごとの単元の取得・追加・編集・削除・貼り付けでの一括登録 |
| `hooks/useMemoRecord.ts` | 既存メモの`unit_id`を取得。`saveMemo`に`unitId`を追加。コマの単元を一括更新する`updateSlotUnit`を追加 |
| `hooks/useStudentMemos.ts` | `memo`のselectに`unit(name)`を追加し、`StudentMemoRow.unitName`を持たせる |
| `hooks/useSharedMemosForPeriod.ts` | `memo`のselectに`unit(name)`を追加(`left join`のまま)。学習・総合の科目名による絞り込みは変更しない |
| `app/(main)/subjects/page.tsx` | 科目の行を折りたたみ化し、単元の管理UIを追加 |
| `app/(main)/subjects/SubjectUnitList.tsx`(新規) | 開いた科目の単元一覧・追加・編集・削除・貼り付け一括登録 |
| `app/(main)/memos/record/RecordView.tsx` | 単元の`Select`を追加 |
| `app/(main)/memos/students/[[...id]]/StudentMemosContent.tsx` | 見出しの単元名表示、`groupBySubject`を`groupMemosBySubjectAndUnit`に置き換え |
| `components/memo/StudentMemoRow.tsx` | 変更なし(単元の選択は画面側の共通プルダウンで扱う) |
| `components/comment/CommentAiAssist.tsx` | 生成単位の切り替えと「単元ごとに生成」の一覧・一括生成・反映を追加 |
| `components/comment/UnitCommentDraftCard.tsx`(新規) | 単元1件分のカード(生成・編集・コピー・貼り付け・採用チェック) |
| `app/(main)/settings/prompt-template/PromptTemplateForm.tsx` | 案内文の追記のみ |
| `hooks/useGenerateComment.ts`・`lib/hono-server/**` | 変更なし(既存エンドポイントを単元ごとに呼ぶだけ) |

## テストへの影響

| テスト | 影響 |
|---|---|
| `tests/db/schema.test.ts` | `unit`・`memo.unit_id`・複合外部キーの存在検証を追加 |
| `tests/db/rls.test.ts` | 他教員の単元を読めない・書けないケースを追加 |
| `tests/db/rpc-export.test.ts` | `subjects[].units`・`memos[].unitId`を追加。既存キーの検証は維持 |
| `tests/db/rpc-subject.test.ts` | 科目削除で単元がcascade削除されること、メモがある科目は従来どおり`SUBJECT_IN_USE`で拒否されることを追加 |
| `shared/prompt-builder.test.ts` | 単元ありのメモ行表記、`{{unitName}}`の置換、ひな形に`{{unitName}}`がない場合に従来どおりであることを追加 |
| `shared/group-memos-by-unit.test.ts`(新規) | 単元ごとの分類・「単元未設定」が最後に来ること・並び順 |
| `shared/group-memos-by-subject-unit.test.ts`(新規) | 教科 → 単元の2段化、単元付きが0件の教科はフラットのまま |
| `shared/parse-unit-list.test.ts`(新規) | 1行1単元・先頭列のみ・空行/空セルの無視・重複の集約・空入力 |
| `e2e/subjects.spec.ts` | 単元の追加・編集・削除、貼り付けでの一括登録(重複のスキップを含む) |
| `e2e/memos-record.spec.ts` | 単元を選んでメモを保存、単元の付け替えで既存メモも更新される |
| `e2e/memos-students.spec.ts` | 教科別表示で単元の小見出しが出る |
| `e2e/memo-unit.spec.ts`(新規) | 「単元ごとに生成」で単元カードが並び、選んだ案が所見欄に連結して反映される |
| `e2e/comments-class.spec.ts` | 生成単位の既定が「まとめて生成」で、従来の挙動が変わらないことの確認 |

## モックアップへの影響

| ファイル | 影響 |
|---|---|
| `mockups/subject-management.html` | 科目の折りたたみと単元の一覧・追加フォーム・貼り付け一括登録を反映 |
| `mockups/class-record.html` | 単元のプルダウンを反映 |
| `mockups/student-memo-list.html` | 単元名の表示と教科 → 単元の2段表示を反映 |
| `mockups/comment.html` | 生成単位の切り替えと単元カードの一覧を反映 |
| `mockups/settings.html` | ひな形の案内文に`{{unitName}}`を追記 |

## ドキュメントへの影響

| ドキュメント | 影響 |
|---|---|
| `docs/requirements.md` | F6(授業記録)・F7(生徒別メモ一覧)・F9/F10(所見生成)の本文に単元を反映。用語集に「単元」を追加 |
| `docs/data-model.md` | ER図に`UNIT`を追加し、`MEMO`に`unit_id`を追加 |
| `docs/design.md` | §4.2のDDLに`unit`と`memo.unit_id`を追加。§5.4(直接Supabaseアクセスのパターン)に単元の操作を追加。§5.5に新しい純粋関数、§5.7に`useUnits`を追加 |
| `docs/design/screens.md` | 科目管理・授業記録・生徒別メモ一覧・所見管理の構成要素に単元を追加 |
| `docs/design/components.md` | 新規の共通コンポーネントは作らないため追記のみ(既存コンポーネントの使用箇所に単元関連の画面を追加) |
| `docs/design/user-flow.md` | 変更なし(画面遷移は変わらない) |
| `docs/features/README.md` | 実装済み一覧に本機能の行を追加し、科目管理・授業記録・生徒別メモ一覧・所見管理の行にタスクID範囲を追記 |
| `docs/manual/` | 使い方説明書に単元の登録(1件ずつ・貼り付けで一括)・記録・単元ごとの所見生成の手順を追加 |
| `docs/tasks.md` | 冒頭に「機能改修のタスクは`docs/features/<機能名>/tasks.md`が正」と明記(本機能の行は`docs/features/README.md`に置き、索引を二重に持たない) |

## 本番運用への影響

- **マイグレーションを先に適用する。** 加算的な変更なので、適用後も現行(単元を知らない)コードはそのまま動作する。一方で**逆順は壊れる**: 新コードはメモ保存時に`unit_id`を送るため、列が無いDBに対してはPostgRESTが`PGRST204`を返し、授業記録のメモ保存が失敗する。PRのプレビューデプロイを試す場合も、先に適用しておく必要がある
- データ移行は不要。既存メモはすべて「単元未設定」として扱われる
- 本番にある検証用の生徒32名(クラス「1-2」出席番号4〜35)のメモにも影響はない(単元が`null`で追加されるだけ)
- 「単元ごとに生成」は単元数ぶんのAI呼び出しになるため、教員が自分のAPIキーで使う場合の課金が増えうる。画面上で単元ごとに生成できるようにしているため、不要な単元の呼び出しは避けられる

## 同時にリリースする必要があるもの

本機能のマイグレーション・フロントエンド・ドキュメント・モックアップは1つのPRにまとめる。単元マスタがない状態では授業記録の単元プルダウンが空になるだけで、機能として壊れた中間状態にはならないため、段階リリースやフィーチャーフラグは置かない。
