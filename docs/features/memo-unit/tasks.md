# 実装タスク: 単元の記録と単元別の所見生成

対応する要件は`docs/features/memo-unit/requirements.md`、設計は`docs/features/memo-unit/design.md`、影響範囲は`docs/features/memo-unit/impact.md`を参照。

ID接頭辞: `UN-`。**加算的な変更のみ(テーブル追加・nullable列追加)で既存の制約・RLSポリシーを入れ替えないため、2フェーズ方式(expand/contract)のタスクは置かない。** 段階リリース用のフィーチャーフラグも置かない(単元未登録の状態ではプルダウンが空になるだけで、既存機能の挙動は変わらないため)。

順序: データモデル変更 → 既存DBテスト追従 → `shared/`(スキーマ・純粋関数・プロンプト) → `hooks/` → UI統合 → モックアップ → E2E → ドキュメント。

---

- [x] **UN-001** `unit`テーブルと`memo.unit_id`のマイグレーションを作成する
  - DoD: `supabase/migrations/<timestamp>_memo_unit.sql`が作成され、(1)`unit`の新設(`subject_id`必須・`on delete cascade`・`unique (id, subject_id)`・`unit_subject_id_idx`)、(2)`enable row level security`と`subject`経由のポリシー、(3)`grant select, insert, update, delete ... to authenticated, service_role`、(4)`memo.unit_id`の追加と複合外部キー`(unit_id, subject_id) → unit(id, subject_id) on delete set null (unit_id)`、(5)`unit`への`set_updated_at`トリガー、(6)`export_teacher_data`の`create or replace`(`subjects[].units`・`memos[].unitId`の追加)を含む。既存テーブルの列・制約・RLSポリシーには一切触れていない。ローカルで`npx supabase db reset`が最後まで適用される
  - 依存: なし
  - ロールバック: ローカル未適用ならファイル削除のみ。本番適用後は`design.md` §8の手順(`drop constraint`・`drop column`・`drop table`・`export_teacher_data`を戻す)で新規マイグレーションを追加する

- [x] **UN-002** `tests/db/schema.test.ts`・`tests/db/rls.test.ts`を追従させる
  - DoD: `unit`のテーブル・列・`unique (id, subject_id)`、`memo.unit_id`と複合外部キーの存在が検証される。単元を削除すると`memo.unit_id`が`null`になり`subject_id`は残ること、メモ自体が消えないことが検証される。`rls.test.ts`に「他教員の単元を読めない」「他教員の科目に対して単元を作れない」のケースが追加される。`npm run test:db`が通る
  - 依存: UN-001
  - ロールバック: テストのrevertのみ

- [x] **UN-003** `tests/db/rpc-export.test.ts`・`tests/db/rpc-subject.test.ts`を追従させる
  - DoD: エクスポートに`subjects[].units`と`memos[].unitId`が含まれることを検証し、**既存キー(`subjects[].name`・`memos[]`の既存項目・`comments`・`lifeComments`・`generalComments`等)が従来どおり出力されることの検証も維持されている**。`rpc-subject.test.ts`に「単元を持つ科目を削除すると単元もcascadeで消える」「メモがある科目は従来どおり`SUBJECT_IN_USE`で拒否される」を追加する。`npm run test:db`が通る
  - 依存: UN-001
  - ロールバック: テストのrevertのみ

- [x] **UN-004** zodスキーマに単元・生成単位を追加する
  - DoD: `shared/schemas/index.ts`に`unitInputSchema`(名前のtrim+1文字以上)と`generationScopeSchema`(`whole` / `per_unit`)が追加され、`memoInputSchema`に`unitId`(uuid・nullable・既定null)が追加される。`shared/schemas/index.test.ts`に正常値・異常値の検証が追加され、`npm run test`・`npx tsc --noEmit`が通る
  - 依存: なし
  - ロールバック: 追加分のrevertのみ。後続タスクが参照するためUN-008〜UN-011と併せて戻す

- [x] **UN-005** `shared/prompt-builder.ts`を単元に対応させる
  - DoD: `PromptMemo`に`unitName?: string | null`が追加され、`formatMemoLine`が単元ありのとき`- 2026-10-05 3時限 算数(分数のかけ算): 内容`、なしのとき従来どおりの表記になる。`buildPrompt`が`unitName`引数を受け取り`{{unitName}}`を置換する(未指定時は「指定なし」)。**既定ひな形3種(`DEFAULT_PROMPT_TEMPLATE`・`DEFAULT_LIFE_PROMPT_TEMPLATE`・`DEFAULT_GENERAL_PROMPT_TEMPLATE`)の文面は変更しない。** `shared/prompt-builder.test.ts`に単元あり/なしの表記、`{{unitName}}`の置換、ひな形に`{{unitName}}`がない場合に従来と同一の出力になることが追加され、`npm run test`が通る
  - 依存: なし
  - ロールバック: 追加分のrevertのみ

- [x] **UN-006** `shared/group-memos-by-unit.ts`を追加する
  - DoD: `groupMemosByUnit(memos: PromptMemo[]): UnitMemoGroup[]`と`UNIT_UNSET_LABEL = "単元未設定"`がexportされる。単元ごとに最初に現れた順でまとめ、単元未設定のメモは常に最後のグループになる。単元未設定のメモが0件ならそのグループは作られない。`shared/group-memos-by-unit.test.ts`で分類・並び順・空入力が検証され、`npm run test`が通る
  - 依存: UN-005
  - ロールバック: ファイル削除のみ

- [x] **UN-007** `shared/group-memos-by-subject-unit.ts`を追加する
  - DoD: `groupMemosBySubjectAndUnit(memos: StudentMemoRow[]): SubjectGroup[]`がexportされ、教科ごとにまとめた上で、その教科に単元付きメモが1件以上あるときだけ単元の小グループに分ける(なければ小グループなしでメモをそのまま持つ)。単元未設定の小グループは単元付きの後に置かれる。生活メモ(単元を持たない)の教科グループには小グループが作られない。`shared/group-memos-by-subject-unit.test.ts`で各ケースが検証され、`npm run test`が通る
  - 依存: UN-009(`StudentMemoRow.unitName`の型定義)。型だけ先に足せば並行して進めてよい
  - ロールバック: ファイル削除のみ

- [x] **UN-008** `hooks/useUnits.ts`を追加する
  - DoD: `useUnits(subjectId)`が科目ごとの単元を`created_at`昇順で取得し、`createUnit`・`updateUnit`・`deleteUnit`を提供する。`teacher_id`をクライアントから渡さない(`unit`は`subject_id`のみを持つ)。`subjectId`が`null`のときはクエリを実行しない。楽観的更新は行わず、成功後に`invalidateQueries`する。`npx tsc --noEmit`が通る
  - 依存: UN-001, UN-004
  - ロールバック: ファイル削除のみ

- [x] **UN-009** `hooks/useMemoRecord.ts`・`hooks/useStudentMemos.ts`・`hooks/useSharedMemosForPeriod.ts`を単元に対応させる
  - DoD: (1)`useMemoRecord`が既存メモの`unit_id`を取得し、`saveMemo`が`unitId`を一緒に`upsert`し、そのコマの保存済みメモ全件の`unit_id`を更新する`updateSlotUnit`を提供する。(2)`useStudentMemos`が`memo`のselectに`unit(name)`を加え、`StudentMemoRow`に`unitName: string | null`を持たせる(生活メモは常に`null`)。(3)`useSharedMemosForPeriod`が`memo`のselectに`unit(name)`を加え`PromptMemo.unitName`を埋める。**`unit`の埋め込みは`left join`(既定)のままにし、単元未設定のメモが落ちないことを確認する。** 学習・総合の科目名による絞り込みロジックは変更しない。`npx tsc --noEmit`が通る
  - 依存: UN-001, UN-004, UN-005
  - ロールバック: 各フックのrevertのみ。DBの列が残るだけで既存機能は動作する

- [x] **UN-010** 科目管理画面に単元の管理UIを追加する
  - DoD: `/subjects`の科目の行が開閉でき(同時に開くのは1つ)、開いた中に単元の一覧(登録順)・追加フォーム・インライン編集・削除がある。単元0件のときは案内が出る。単元の削除は`ConfirmDialog`で確認し、本文に「この単元を使っているメモは単元未設定に戻ります(メモは削除されません)」が含まれる。科目の削除確認の本文に「登録済みの単元もまとめて削除されます」が追記される。`docs/design/design-system.md`にない色・フォントサイズ・余白を追加していない
  - 依存: UN-008
  - ロールバック: 画面のrevertのみ

- [x] **UN-011** 授業記録画面に単元のプルダウンを追加する
  - DoD: `/memos/record`に単元の`Select`があり、「選択しない」+その科目の単元が選べる。単元0件のときは`emptyMessage`で案内が出て選択できない。そのコマの保存済みメモに単元があれば初期選択される。単元を変えるとそのコマの保存済みメモ全件の単元が更新され、失敗時はトーストが出て表示が確定値に戻る。新規保存時は選択中の単元が記録される。日付・時限を変えると選択状態が移動後のコマの状態になる
  - 依存: UN-008, UN-009
  - ロールバック: 画面のrevertのみ

- [x] **UN-012** 生徒別メモ一覧に単元名を表示する
  - DoD: メモの見出しが単元ありのとき「日付 ・ 時限 ・ 教科 ・ 単元名」になり、編集・削除の`aria-label`にも単元名が含まれる。「教科別」表示が`groupMemosBySubjectAndUnit`を使い、単元付きメモがある教科だけ単元の小見出し(`<h3>`)に分かれる。単元未設定の小見出しは最後に置かれる。生活メモには単元の表示が出ない
  - 依存: UN-007, UN-009
  - ロールバック: 画面のrevertのみ

- [x] **UN-013** AI生成セクションに「単元ごとに生成」モードを追加する
  - DoD: `CommentAiAssist`に生成単位の`SegmentedControl`(既定は「まとめて生成」)が追加され、`kind === "life"`では描画されない。「単元ごとに生成」で`groupMemosByUnit`の順に単元カードが並び、各カードに単元名・メモ件数・採用チェック・編集可能な所見案・文字数が表示される。「AIで直接生成」では各カードの個別生成と「すべての単元を生成」(順次実行・進捗表示・1件失敗しても続行)ができ、「プロンプトを作成」では各カードでプロンプトのコピーと応答の貼り付けができる。「選択した案を所見欄に反映」で選択済みの案が`\n\n`区切りで連結され`onApply`に渡され、`creationMethod`は直接生成由来が含まれれば`direct_ai`、それ以外は`prompt_copy`になる。目安文字数のラベルが生成単位で切り替わる。材料0件のときは従来の`EmptyState`が出る。**「まとめて生成」の挙動は従来と完全に同一**
  - 依存: UN-006, UN-009
  - ロールバック: `CommentAiAssist`と`UnitCommentDraftCard`のrevertのみ

- [x] **UN-014** 単元カードを`components/comment/UnitCommentDraftCard.tsx`に切り出す
  - DoD: 単元1件分の表示・生成・編集・コピー・貼り付け・採用チェックが`UnitCommentDraftCard`に分離され、`CommentAiAssist`は一覧と連結のみを担う。`npm run lint`・`npx tsc --noEmit`が通る
  - 依存: UN-013(UN-013の実装中に分離してよい)
  - ロールバック: `CommentAiAssist`への内製化に戻す

- [x] **UN-015** プロンプトひな形編集画面の案内文に`{{unitName}}`を追記する
  - DoD: `/settings/prompt-template`の案内文に`{{unitName}}`(単元名)が追加される。ひな形の初期値は変更しない
  - 依存: UN-005
  - ロールバック: 案内文のrevertのみ

- [x] **UN-016** モックアップを実装内容に合わせて更新する
  - DoD: `mockups/subject-management.html`(科目の折りたたみ+単元)・`mockups/class-record.html`(単元のプルダウン)・`mockups/student-memo-list.html`(単元名・教科→単元の2段)・`mockups/comment.html`(生成単位の切り替え+単元カード)・`mockups/settings.html`(`{{unitName}}`の追記)が実装と一致する
  - 依存: UN-010〜UN-015
  - ロールバック: モックアップのrevertのみ。アプリの動作に影響しない

- [x] **UN-017** E2Eを追加・更新する
  - DoD: `e2e/subjects.spec.ts`に単元の追加・編集・削除、`e2e/memos-record.spec.ts`に単元を選んだ保存と付け替えで既存メモも更新されること、`e2e/memos-students.spec.ts`に教科別表示の単元の小見出し、新規`e2e/memo-unit.spec.ts`に「単元ごとに生成」で単元カードが並び選んだ案が連結して所見欄に反映されること、`e2e/comments-class.spec.ts`に生成単位の既定が「まとめて生成」であることが追加される。`npm run test:e2e`が通る(落ちた場合は`SKILL.md` §7.2の手順で単独実行と切り分ける)
  - 依存: UN-010〜UN-015
  - ロールバック: テストのrevertのみ

- [ ] **UN-018** プロジェクト全体のドキュメントを更新する
  - DoD: (1)`docs/requirements.md`のF6・F7・F9・F10の**本文**に単元が反映され、用語集に「単元」が追加される(旧本文に注記を足すのではなく本文を書き換える)。(2)`docs/data-model.md`のER図に`UNIT`と`MEMO.unit_id`が入る。(3)`docs/design.md` §4.2のDDLが`supabase/migrations/`の適用結果と一致し、§5.4・§5.5・§5.7に単元関連の追加が入る。(4)`docs/design/screens.md`の該当4画面に単元が反映される。(5)`docs/features/README.md`の実装済み一覧に本機能の行が追加され、科目管理・授業記録・生徒別メモ一覧・所見管理の行にタスクID範囲が追記される。(6)`docs/tasks.md`に本機能の行が追加される。(7)`git grep -n "未実装\|未反映\|予定" -- docs`で本機能に関する古い注記が残っていない
  - 依存: UN-001〜UN-017
  - ロールバック: ドキュメントのrevertのみ

- [ ] **UN-019** `docs/features/memo-unit/test-cases.md`と使い方説明書を更新する
  - DoD: `test-cases.md`に最低限のテスト(P0)と後で確認するテスト(P1〜P3)が、既存の機能ディレクトリと同じ形式で書かれる。`docs/manual/`に単元の登録・授業記録での選択・単元ごとの所見生成の手順が追加される
  - 依存: UN-017
  - ロールバック: ドキュメントのrevertのみ

- [ ] **UN-020** 検証をすべて通す
  - DoD: `npm run lint`・`npm run test`・`npm run test:db`・`npx tsc --noEmit`・`npm run build`・`npm run test:e2e`がすべて通る。`docs/design.md` §4.2のDDLとマイグレーションの適用結果を突き合わせて差異がない
  - 依存: UN-001〜UN-019
  - ロールバック: なし(検証タスク)
