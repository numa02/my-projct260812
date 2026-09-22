# 実装タスク: 科目の標準セット投入

対応する設計は`docs/features/subjects/design.md`、影響範囲は`docs/features/subjects/impact.md`を参照。

ID接頭辞: `SJ-`。既存テーブル・既存カラムへの変更を伴わない追加のみの機能のため、互換性レイヤー用タスクは置かない。フィーチャーフラグ等の段階リリース用タスクも置かない(理由: 新設する`seed_standard_subjects`関数は既存データ・既存フローに一切触れない加算的な変更であり、失敗時は関数を無視するだけで実害がないため)。

順序: データモデル変更(RPC) → バックエンド統合テスト → フロントエンド基盤(hooks・スキーマ) → モックアップ → UI統合 → テスト。

**完了(2026-09-15確認)**: 以下SJ-001〜SJ-010はすべてコミット`6042e64`(「科目の標準セット投入機能を追加(SJ-001〜SJ-010)」)で実装済み。チェックボックスが未更新のまま残っていたため、実態に合わせて更新した。

---

- [x] **SJ-001** `seed_standard_subjects`RPCのマイグレーションを作成する
  - DoD: `supabase/migrations/<timestamp>_rpc_seed_standard_subjects.sql`が作成され、`pg_advisory_xact_lock(hashtext(v_teacher_id::text))`によるteacher_id単位の直列化、小学校10科目/中学校11科目の投入、既存科目名との完全一致による重複スキップを含む。ローカルで`supabase start`→`supabase db reset`を実行し、マイグレーションが最後まで適用される
  - 依存: なし
  - ロールバック: ローカル未適用の場合はファイル削除のみ。本番適用後にロールバックする場合は`drop function seed_standard_subjects(text);`を含む新規マイグレーションを追加する(関数を呼び出すコード側が同時にロールバックされていれば、関数の削除自体に既存データへの影響はない)

- [x] **SJ-002** `tests/db/rpc-subject.test.ts`に`seed_standard_subjects`の統合テストを追加する
  - DoD: 「小学校セットの投入」「中学校セットの投入」「既存科目と重複する項目はスキップされる」「同一学校区分を2回連続実行しても2回目は0件追加」「2つの呼び出しを同時実行しても合計で重複登録されない(advisory lockの検証)」「他教員の科目一覧に影響しない」の各ケースが通り、`npm run test:db`が通る
  - 依存: SJ-001
  - ロールバック: 追加したテストケースのみrevertする

- [x] **SJ-003** `hooks/useSubjects.ts`に`seedStandardSubjects`mutationを追加する
  - DoD: `supabase.rpc("seed_standard_subjects", { p_school_level })`を呼び出すmutationが実装され、成功時に既存の`subjects`クエリを`invalidateQueries`する。既存の`createSubject`等の実装パターンに準拠する
  - 依存: SJ-001
  - ロールバック: 追加したmutationのみrevertする。`useSubjects`の他機能(一覧取得・個別作成)への影響なし

- [x] **SJ-004** `shared/schemas/index.ts`の`signupInputSchema`に`schoolLevel`を追加する
  - DoD: `schoolLevel: z.enum(["elementary", "middle"]).optional()`が追加され、`shared/schemas/index.test.ts`に「未選択」「小学校」「中学校」「不正な値」のバリデーションケースが追加される。`npm run test`が通る
  - 依存: なし
  - ロールバック: スキーマ変更のみrevertする。この時点ではフロント側で未参照のため他画面への影響はない

- [x] **SJ-005** `mockups/subject-management.html`を更新する
  - DoD: 「標準科目セットを追加」の折りたたみセクション(学校区分選択+「追加する」ボタン)のモックアップが既存の科目一覧の上に追加され、ブラウザで開いて崩れずに表示される
  - 依存: なし
  - ロールバック: モックアップのみのためrevert容易

- [x] **SJ-006** `mockups/signup.html`を更新する
  - DoD: 学校区分(任意、既定は「選択しない」)の選択欄がメールアドレス・パスワード入力の下に追加されたモックアップになる
  - 依存: なし
  - ロールバック: モックアップのみのためrevert容易

- [x] **SJ-007** `app/(auth)/signup/page.tsx`に学校区分選択を統合する
  - DoD: `register("schoolLevel")`経由で学校区分のSelectが表示され、他フィールド(email, password)と同じくreact-hook-form管理下にある。サインアップ成功後、`schoolLevel`が選択されていれば`seed_standard_subjects`RPCを呼ぶ。RPC呼び出しが失敗してもトップページへの遷移(`router.push("/")`)は妨げられず、遷移先で`useToast`により「標準科目の登録に失敗しました。科目管理画面から再度お試しください」が表示される。手動でサインアップ〜科目一覧確認まで一連の動作確認済み
  - 依存: SJ-003, SJ-004, SJ-006
  - ロールバック: このコミットをrevertすれば既存のサインアップ(email/passwordのみ)に戻る。DB変更を伴わない

- [x] **SJ-008** `app/(main)/subjects/page.tsx`に既存アカウント向けの投入導線を追加する
  - DoD: 折りたたみセクション(学校区分選択+「追加する」ボタン)が表示され、ボタンは`loading={seedStandardSubjects.isPending}`で実行中の二重送信を防ぐ。実行すると科目一覧に反映される。既存の1件ずつの手動登録フローに影響がないことを確認済み
  - 依存: SJ-003, SJ-005
  - ロールバック: このコミットをrevertする。DB変更を伴わない

- [x] **SJ-009** `e2e/golden-path.spec.ts`のサインアップ手順を確認・調整する
  - DoD: サインアップ画面への学校区分選択欄の追加によって既存のE2Eフローが壊れていないことを確認し、必要であれば「選択しない」を明示的に選ぶ操作を追加する。`npm run test:e2e`が通る
  - 依存: SJ-007
  - ロールバック: テスト変更のみrevertする

- [x] **SJ-010** `docs/features/subjects/test-cases.md`を更新する
  - DoD: サインアップ時投入・既存アカウントでの投入・重複スキップのP0/P1テストケースが追記される
  - 依存: SJ-007, SJ-008
  - ロールバック: ドキュメントのみのため無条件にrevert可能

---

## 追加: 小学校標準セットへの教科「生活」の追加(2026-09-22)

小学校1・2年の教科「生活」が標準セットに含まれていなかったため追加する。同じPRで生活メモの表示ラベルを「生活記録」に変更する(`docs/features/ui-clarity/` UC-001)。教科「生活」が登録できる状態で生活メモのラベルが「生活」のままだと、生徒別メモ一覧の教科別表示で両者が同一グループに混ざるため、両者は必ず同時に反映する。

- [ ] **SJ-011** `seed_standard_subjects`の小学校配列に「生活」を追加するマイグレーションを作成する
  - DoD: `supabase/migrations/<timestamp>_seed_standard_subjects_add_seikatsu.sql`が`create or replace function seed_standard_subjects`で関数全体を再定義し、小学校の配列が11科目(国語、算数、理科、社会、英語、図画工作、体育、音楽、生活、総合、学活)になる。中学校の配列は変更しない。`pg_advisory_xact_lock`による直列化・既存科目名との重複スキップは維持する。ローカルで`npx supabase db reset`が最後まで適用される
  - 依存: なし
  - ロールバック: ローカル未適用ならファイル削除のみ。本番適用後は「生活」を除いた10科目の配列で`create or replace function`する新規マイグレーションを追加する。既に投入された科目レコードは削除されないため、不要なら教員が科目管理画面から個別に削除する(既存データを壊す変更ではない)

- [ ] **SJ-012** `tests/db/rpc-subject.test.ts`を11科目に追従させる
  - DoD: 小学校セットの投入件数・科目名の期待値が11科目に更新され、「生活」が含まれることを検証する。中学校セットの期待値は変更しない。既存の重複スキップ・advisory lock・他教員への非干渉の各ケースが引き続き通り、`npm run test:db`が通る
  - 依存: SJ-011
  - ロールバック: テストのrevertのみ

- [x] **SJ-013** 標準セットの科目数・科目名の記載をドキュメント全体で更新する
  - DoD: `docs/features/subjects/requirements.md`の科目一覧表(小学校10科目→11科目)、`docs/features/subjects/design.md`の配列リテラル、`docs/design.md` §5.2のRPC一覧の説明(「小学校10科目/中学校11科目」)が11科目に更新される。`git grep -n "10科目"`で古い記載が残っていないことを確認する
  - 依存: SJ-011
  - ロールバック: ドキュメントのrevertのみ

- [x] **SJ-014** `docs/features/subjects/test-cases.md`を更新する
  - DoD: 小学校セットの投入で「生活」を含む11科目が登録されることの確認と、既に「生活」を手動登録済みの場合にスキップされることの確認がテストケースに反映される
  - 依存: SJ-012
  - ロールバック: ドキュメントのrevertのみ
