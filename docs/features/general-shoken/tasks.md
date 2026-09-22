# 実装タスク: 総合の所見

対応する設計は`docs/features/general-shoken/design.md`、影響範囲は`docs/features/general-shoken/impact.md`を参照。

ID接頭辞: `GS-`。**加算的な変更のみ(テーブル追加・列追加)で既存の制約を入れ替えないため、2フェーズ方式・互換性レイヤー用のタスクは置かない。** 段階リリース用のフィーチャーフラグも置かない(新しいタブが増えるだけで、既存の学習・生活の所見の挙動が変わらないため)。

順序: データモデル変更 → 既存DBテスト追従 → `shared/`(スキーマ・プロンプト初期値) → `hooks/` → UI統合 → モックアップ → E2E → ドキュメント。

---

- [x] **GS-001** `student_general_comment`と`prompt_template.general_content`のマイグレーションを作成する
  - DoD: `supabase/migrations/<timestamp>_general_shoken.sql`が作成され、(1)`student_general_comment`の新設(`student_id`に`unique`、`on delete cascade`)、(2)`enable row level security`と`student`→`class`経由のポリシー、(3)`grant select, insert, update, delete ... to authenticated, service_role`、(4)`prompt_template`への`general_content`列追加、(5)`export_teacher_data`の`create or replace`を含む。`updated_at`は`default now()`のみでトリガーは設けない(既存2テーブルと挙動を揃える。`design.md` §1.1参照)。既存テーブルの列・制約には一切触れていない。ローカルで`npx supabase db reset`が最後まで適用される
  - 依存: なし
  - ロールバック: ローカル未適用ならファイル削除のみ。本番適用後は`drop table`・`drop column`と`export_teacher_data`を戻す新規マイグレーションを追加する(`design.md` §8)

- [x] **GS-002** `tests/db/schema.test.ts`・`tests/db/rls.test.ts`を追従させる
  - DoD: `student_general_comment`のテーブル・列・一意制約と`prompt_template.general_content`の存在が検証される。`rls.test.ts`に「他教員の総合の所見を読めない」「他教員の生徒に対して総合の所見を書けない」のケースが追加される。`npm run test:db`が通る
  - 依存: GS-001
  - ロールバック: テストのrevertのみ

- [x] **GS-003** `tests/db/rpc-export.test.ts`にエクスポートの検証を追加する
  - DoD: 総合の所見を保存した状態でエクスポートすると、生徒ごとに`generalComments`が含まれ、`promptTemplate.generalContent`も含まれることを検証する。**既存キー(`comments`・`lifeComments`等)が従来どおり出力されることの検証も維持されている**。`npm run test:db`が通る
  - 依存: GS-001
  - ロールバック: テストのrevertのみ

- [x] **GS-004** `commentKindSchema`に`"general"`を追加する
  - DoD: `shared/schemas/index.ts`の`commentKindSchema`が`["learning", "life", "general"]`になり、`npx tsc --noEmit`で`Record<CommentKind, ...>`の網羅漏れが検出されない状態になる
  - 依存: なし
  - ロールバック: enumから`"general"`を外す。ただし後続タスクの実装が型エラーになるため、GS-005〜GS-010と併せてrevertする

- [x] **GS-005** 総合の所見用プロンプトひな形の初期値を追加する
  - DoD: `shared/prompt-builder.ts`に`DEFAULT_GENERAL_PROMPT_TEMPLATE`が追加される。文面は教員から提示されたもので、記法は学習用・生活用と同じ(【入力情報】に`{{pseudonymCode}}`・`{{grade}}`・`{{targetCharCount}}`、続けて`{{memos}}`。学期の指定なし)。`shared/prompt-builder.test.ts`の初期値のループ検証に含まれ、`npm run test`が通る
  - 依存: なし
  - ロールバック: 定数の削除。`usePromptTemplate`が参照するため、GS-006と併せてrevertする

- [x] **GS-006** `hooks/`を総合に対応させる
  - DoD: `useStudentComments`の`COMMENT_TABLE`に`general: "student_general_comment"`が追加される。`usePromptTemplate`が`general_content`列を読み書きし、未保存時は総合用の初期値を返す。`useSharedMemosForPeriod`の`general`分岐が`subject!inner(name)`+`eq("subject.name", "総合")`で科目「総合」の授業メモのみを返す。**学習の所見側のクエリは変更しない**
  - 依存: GS-001, GS-004, GS-005
  - ロールバック: 各フックのrevertのみ。DBのテーブル・列が残るだけで既存機能は動作する

- [x] **GS-007** 所見管理画面に「総合の所見」タブを追加する
  - DoD: `ClassCommentsContent`のタブが3つになり、総合タブでそのクラスの生徒全員の行が表示される。`StudentCommentRow`の所見欄ラベルが`general`で「総合の所見」になる(学習は従来の「所見」表記を維持)。`CommentAiAssist`のメモのラベルが`general`で「総合の授業メモ」になり、材料0件時は「送信可能な総合の授業メモが存在しません」が表示される。対象期間は3タブ共通のまま。`docs/design/design-system.md`にない色・サイズ・余白を追加していない
  - 依存: GS-006
  - ロールバック: 各コンポーネントのrevertのみ

- [x] **GS-008** プロンプトひな形編集画面に総合用のフォームを追加する
  - DoD: `/settings/prompt-template`に「総合の所見用のひな形」の編集欄が追加され、3つが独立に保存できる。総合用だけを保存しても学習用・生活用は変更されない
  - 依存: GS-006
  - ロールバック: フォーム追加分のrevertのみ

- [x] **GS-009** モックアップを実装内容に合わせて更新する
  - DoD: `mockups/comment.html`の所見の種類タブが3つ、`mockups/settings.html`のひな形編集欄が3つになり、実装と一致する
  - 依存: GS-007, GS-008
  - ロールバック: モックアップのrevertのみ。アプリの動作に影響しない

- [x] **GS-010** E2Eを追加する
  - DoD: `e2e/comments-class.spec.ts`(または新規`e2e/general-shoken.spec.ts`)に、(1)総合タブで所見を保存しても学習・生活の所見が変わらないこと、(2)プロンプトに科目「総合」のメモだけが含まれ他教科のメモが含まれないこと、(3)科目「総合」のメモがない場合に案内が出ること、が追加される。`e2e/settings-prompt-template.spec.ts`に総合用ひな形の保存独立性のケースが追加される。`npm run test:e2e`が通る
  - 依存: GS-007, GS-008
  - ロールバック: テストのrevertのみ

- [x] **GS-011** 全体設計書・要件定義書を更新する
  - DoD: `docs/requirements.md`(所見3種の構成・用語集・F9/F10/F11/F14の該当箇所)、`docs/data-model.md`(ER図・テーブル定義・一意制約一覧)、`docs/design.md` §4(DDL)・§5.2(`export_teacher_data`の説明)、`docs/design/screens.md`(画面12・画面13)が実装と一致する。`docs/design.md` §4.2のDDLが`supabase/migrations/`の適用結果と一致している
  - 依存: GS-001, GS-007, GS-008
  - ロールバック: ドキュメントのrevertのみ

- [x] **GS-012** テストケース表を更新する
  - DoD: `docs/features/general-shoken/test-cases.md`が作成され、`docs/features/comments/test-cases.md`・`docs/features/settings-prompt-template/test-cases.md`に総合のケースが追加される。`docs/features/README.md`の実装済み一覧に本機能の行が追加される
  - 依存: GS-010
  - ロールバック: ドキュメントのrevertのみ

- [x] **GS-013** 検証を通す
  - DoD: `npm run lint`・`npm run test`・`npm run test:db`・`npx tsc --noEmit`・`npm run build`・`npm run test:e2e`がすべて通る。`git grep -n "未実装\|未反映\|予定" -- docs`に本機能に関する古い注記が残っていない
  - 依存: GS-001〜GS-012
  - ロールバック: 該当なし(検証タスク)

---

## 追加: レビュー指摘への対応(2026-09-22)

PR作成後のユーザー確認で決まった2件。いずれも同じPRに含める。

- [x] **GS-014** 学習の所見の材料から科目「総合」を除外する
  - DoD: `useSharedMemosForPeriod`の学習側のクエリが`subject!inner(name)`+`neq("subject.name", "総合")`になり、学習の所見の材料に科目「総合」の授業メモが含まれない。`e2e/general-shoken.spec.ts`の学習タブのアサーションが「総合のメモが含まれない」ことの確認に変わり、「科目『総合』のメモしかない場合は学習タブで材料0件になる」ケースが追加される。`npm run test:e2e`が通る
  - 依存: GS-006
  - ロールバック: `neq`の条件を外し`subject(name)`に戻す。DB変更を伴わない

- [x] **GS-015** `updated_at`の自動更新トリガーを追加する(`docs/bugs.md` BUG-009)
  - DoD: `supabase/migrations/<timestamp>_updated_at_triggers.sql`で`set_updated_at()`関数と、`updated_at`を持つ7テーブル(`memo`・`life_memo`・`student_comment`・`student_life_comment`・`student_general_comment`・`prompt_template`・`ai_provider_setting`)への`before update`トリガーが作成される。`tests/db/schema.test.ts`に回帰テスト(所見3種のupsert上書き・メモの更新で`updated_at`が進む)が追加され、`npm run test:db`が通る。`docs/bugs.md`にBUG-009として記録される
  - 依存: GS-001(`student_general_comment`が存在してからトリガーを張るため、マイグレーションの順序が後になる)
  - ロールバック: 7つのトリガーと`set_updated_at()`関数を削除する新規マイグレーションを追加する。既存データには影響しない(トリガーを外すと再び`updated_at`が更新されなくなるだけ)
