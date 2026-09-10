# 実装タスク: 科目の標準セット投入

対応する設計は`docs/features/subjects/design.md`、影響範囲は`docs/features/subjects/impact.md`を参照。

ID接頭辞: `SJ-`。既存テーブル・既存カラムへの変更を伴わない追加のみの機能のため、互換性レイヤー用タスクは置かない。フィーチャーフラグ等の段階リリース用タスクも置かない(理由: 新設する`seed_standard_subjects`関数は既存データ・既存フローに一切触れない加算的な変更であり、失敗時は関数を無視するだけで実害がないため)。

順序: データモデル変更(RPC) → バックエンド統合テスト → フロントエンド基盤(hooks・スキーマ) → モックアップ → UI統合 → テスト。

---

- [ ] **SJ-001** `seed_standard_subjects`RPCのマイグレーションを作成する
  - DoD: `supabase/migrations/<timestamp>_rpc_seed_standard_subjects.sql`が作成され、`pg_advisory_xact_lock(hashtext(v_teacher_id::text))`によるteacher_id単位の直列化、小学校10科目/中学校11科目の投入、既存科目名との完全一致による重複スキップを含む。ローカルで`supabase start`→`supabase db reset`を実行し、マイグレーションが最後まで適用される
  - 依存: なし
  - ロールバック: ローカル未適用の場合はファイル削除のみ。本番適用後にロールバックする場合は`drop function seed_standard_subjects(text);`を含む新規マイグレーションを追加する(関数を呼び出すコード側が同時にロールバックされていれば、関数の削除自体に既存データへの影響はない)

- [ ] **SJ-002** `tests/db/rpc-subject.test.ts`に`seed_standard_subjects`の統合テストを追加する
  - DoD: 「小学校セットの投入」「中学校セットの投入」「既存科目と重複する項目はスキップされる」「同一学校区分を2回連続実行しても2回目は0件追加」「2つの呼び出しを同時実行しても合計で重複登録されない(advisory lockの検証)」「他教員の科目一覧に影響しない」の各ケースが通り、`npm run test:db`が通る
  - 依存: SJ-001
  - ロールバック: 追加したテストケースのみrevertする

- [ ] **SJ-003** `hooks/useSubjects.ts`に`seedStandardSubjects`mutationを追加する
  - DoD: `supabase.rpc("seed_standard_subjects", { p_school_level })`を呼び出すmutationが実装され、成功時に既存の`subjects`クエリを`invalidateQueries`する。既存の`createSubject`等の実装パターンに準拠する
  - 依存: SJ-001
  - ロールバック: 追加したmutationのみrevertする。`useSubjects`の他機能(一覧取得・個別作成)への影響なし

- [ ] **SJ-004** `shared/schemas/index.ts`の`signupInputSchema`に`schoolLevel`を追加する
  - DoD: `schoolLevel: z.enum(["elementary", "middle"]).optional()`が追加され、`shared/schemas/index.test.ts`に「未選択」「小学校」「中学校」「不正な値」のバリデーションケースが追加される。`npm run test`が通る
  - 依存: なし
  - ロールバック: スキーマ変更のみrevertする。この時点ではフロント側で未参照のため他画面への影響はない

- [ ] **SJ-005** `mockups/subject-management.html`を更新する
  - DoD: 「標準科目セットを追加」の折りたたみセクション(学校区分選択+「追加する」ボタン)のモックアップが既存の科目一覧の上に追加され、ブラウザで開いて崩れずに表示される
  - 依存: なし
  - ロールバック: モックアップのみのためrevert容易

- [ ] **SJ-006** `mockups/signup.html`を更新する
  - DoD: 学校区分(任意、既定は「選択しない」)の選択欄がメールアドレス・パスワード入力の下に追加されたモックアップになる
  - 依存: なし
  - ロールバック: モックアップのみのためrevert容易

- [ ] **SJ-007** `app/(auth)/signup/page.tsx`に学校区分選択を統合する
  - DoD: `register("schoolLevel")`経由で学校区分のSelectが表示され、他フィールド(email, password)と同じくreact-hook-form管理下にある。サインアップ成功後、`schoolLevel`が選択されていれば`seed_standard_subjects`RPCを呼ぶ。RPC呼び出しが失敗してもトップページへの遷移(`router.push("/")`)は妨げられず、遷移先で`useToast`により「標準科目の登録に失敗しました。科目管理画面から再度お試しください」が表示される。手動でサインアップ〜科目一覧確認まで一連の動作確認済み
  - 依存: SJ-003, SJ-004, SJ-006
  - ロールバック: このコミットをrevertすれば既存のサインアップ(email/passwordのみ)に戻る。DB変更を伴わない

- [ ] **SJ-008** `app/(main)/subjects/page.tsx`に既存アカウント向けの投入導線を追加する
  - DoD: 折りたたみセクション(学校区分選択+「追加する」ボタン)が表示され、ボタンは`loading={seedStandardSubjects.isPending}`で実行中の二重送信を防ぐ。実行すると科目一覧に反映される。既存の1件ずつの手動登録フローに影響がないことを確認済み
  - 依存: SJ-003, SJ-005
  - ロールバック: このコミットをrevertする。DB変更を伴わない

- [ ] **SJ-009** `e2e/golden-path.spec.ts`のサインアップ手順を確認・調整する
  - DoD: サインアップ画面への学校区分選択欄の追加によって既存のE2Eフローが壊れていないことを確認し、必要であれば「選択しない」を明示的に選ぶ操作を追加する。`npm run test:e2e`が通る
  - 依存: SJ-007
  - ロールバック: テスト変更のみrevertする

- [ ] **SJ-010** `docs/features/subjects/test-cases.md`を更新する
  - DoD: サインアップ時投入・既存アカウントでの投入・重複スキップのP0/P1テストケースが追記される
  - 依存: SJ-007, SJ-008
  - ロールバック: ドキュメントのみのため無条件にrevert可能
