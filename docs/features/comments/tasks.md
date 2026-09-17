# 実装タスク: 所感管理の再設計(期間の記憶・所感の単一化)

対応する設計は`docs/features/comments/design.md`、影響範囲は`docs/features/comments/impact.md`を参照。3機能の中で唯一、不可逆なデータ削除を伴う。

ID接頭辞: `CM-`。**破壊的変更(`student_comment`の列削除・ユニーク制約変更)を伴うため、design.mdで定めた2フェーズ(expand/contract)方式に沿ってタスクを分ける。** CM-003(フェーズ1マイグレーション)が互換性レイヤーであり、これを最初のデータモデル変更タスクとして置く。CM-013(フェーズ2マイグレーション)は新コードの本番安定稼働を確認してから日を空けて実施する、段階リリース相当のタスクとして最後に独立させる(本アプリにフィーチャーフラグの仕組みはないため、マイグレーションのフェーズ分割自体が段階リリースの代替手段)。

順序: バックアップ手順検証 → データモデル変更(互換性レイヤー) → 既存テスト追従 → フロントエンド基盤(hooks・スキーマ) → 既存UIコンポーネントの変更 → モックアップ → 新規UI統合 → テスト → 本番デプロイ → (日を空けて)フェーズ2マイグレーション。

---

- [x] **CM-001** バックアップ・リストア手順をローカル環境でリハーサルする
  - DoD: ローカルの`supabase start`環境で`student_comment`にテストデータ(同一生徒に複数期間の所感を含む)を投入し、`pg_dump -t public.student_comment --data-only`でダンプ→`truncate table student_comment`→`psql -f`でリストア、の一連が成功することを確認する
  - 依存: なし
  - ロールバック: ローカル環境での検証作業のみ。本番に影響なし
  - 完了: コミット`51a60e4`。`pg_dump`のクライアント/サーバーバージョン不一致の落とし穴を`design.md`に追記済み

- [x] **CM-002** `class`テーブルへのカラム追加マイグレーションを作成・ローカル適用する
  - DoD: `supabase/migrations/<timestamp>_class_comment_period.sql`(`comment_period_start_date date`, `comment_period_end_date date`、いずれもnullable)が作成され、`supabase db reset`でローカルに適用される。既存の`class`関連RLSテスト(`tests/db/rls.test.ts`)が引き続き通る
  - 依存: なし
  - ロールバック: ローカル未適用ならファイル削除。本番適用後は該当2カラムを`drop column`する新規マイグレーションを追加する(カラム追加のみなので、既存データへの影響なくdropできる)
  - 完了: コミット`51a60e4`(`supabase/migrations/20260911083009_class_comment_period.sql`)。ローカル適用のみで、本番未適用(CM-013で適用)

- [x] **CM-003(互換性レイヤー)** `student_comment`フェーズ1(拡張)マイグレーションを作成・ローカル適用する
  - DoD: `supabase/migrations/<timestamp>_student_comment_expand.sql`が、①`id`をタイブレーカーに含めた`DISTINCT ON`による生徒ごと最新1件へのDEDUP DELETE、②`period_start_date`/`period_end_date`のNOT NULL解除、③`unique (student_id)`制約の追加、の3ステップで作成される。ローカルで同一生徒に複数期間の所感を持つテストデータを投入した状態で`supabase db reset`を実行し、生徒ごとに1件へ集約されることをSQLクエリで確認する
  - 依存: CM-001(手順検証済みであること)、CM-002(先に軽微な変更を適用する運用上の順序。技術的な依存関係はない)
  - ロールバック: ローカルでは`supabase db reset`でやり直せる。**本番適用後は、`unique(student_id)`のdropとNOT NULLの復元は新規マイグレーションで可能だが、DELETEで失われたデータはCM-001で検証したバックアップ手順からの手動リストアが必要になる。このタスクの本番適用は不可逆な操作を含むことに留意する**
  - 完了: コミット`51a60e4`(`supabase/migrations/20260911083015_student_comment_expand.sql`)。ローカル適用のみで、本番未適用(CM-013で適用)

- [x] **CM-004** `tests/db/rls.test.ts`の`student_comment`関連テストをフェーズ1後のスキーマに追従させる
  - DoD: L311-370の`insert`呼び出しから`period_start_date`/`period_end_date`を除去する。RLSが制約チェックより先に評価されクロステナントのinsert/updateをブロックすることを確認する既存の検証意図は維持する。`npm run test:db`が通る
  - 依存: CM-003
  - ロールバック: テスト変更のみrevertする
  - 完了: コミット`8adf268`

- [x] **CM-005** `shared/schemas/index.ts`の`commentSaveInputSchema`から期間項目を除去する
  - DoD: `periodStartDate`/`periodEndDate`を除いたスキーマに変更し、`shared/schemas/index.test.ts`の該当ケース(L45-46, L55-56相当)を更新する。`npm run test`が通る
  - 依存: CM-003(フェーズ1適用済みのDBに対してのみ整合するスキーマ変更のため)
  - ロールバック: スキーマ変更のみrevertする
  - 完了: コミット`5779c5f`

- [x] **CM-006** `hooks/useClassCommentPeriod.ts`を新規実装する
  - DoD: クラスごとの`comment_period_start_date`/`comment_period_end_date`の取得(`["class-comment-period", classId]`)・保存を行うフックが実装される。開始日・終了日はまとめて1回の`update`呼び出しで送る(個別送信による後勝ち上書きを避けるため)。mutation失敗時は直前にサーバー保存が確認できている値に表示が戻ることを手動確認済み(CLAUDE.mdの楽観的更新禁止方針に従う実装であること)
  - 依存: CM-002
  - ロールバック: 新規ファイルを削除するコミットをrevertする。他ファイルから未参照であれば影響なし
  - 完了: コミット`f9748a3`。当初の実装がコミットし忘れられていたため、e2e検証中に見つかった表示不整合(クラス切替時の巻き戻り等、計4件)の修正と合わせて本コミットで追加された

- [x] **CM-007** `hooks/useStudentComments.ts`を生徒ごと単一所感に対応させる
  - DoD: `select`から期間列を除去し、`upsert`の`onConflict`を`"student_id"`に変更する。戻り値を配列ではなく単一オブジェクト(または`null`)に変更する。**この変更は既存の呼び出し元`StudentCommentRow.tsx`が旧インターフェースを期待しているため単体では型エラーになる。CM-008と同一PR・同一コミットで完結させる**
  - 依存: CM-003, CM-005
  - ロールバック: CM-008とセットでコミットをrevertする(単体revert不可)
  - 完了: コミット`aaf30f8`(CM-008と同一コミット)

- [x] **CM-008** `components/comment/StudentCommentRow.tsx`を単一所感表示に変更する(CM-007と同一コミット)
  - DoD: 対象期間との完全一致による`existing`/`history`振り分けロジック(L67-72相当)を削除し、`useStudentComments`が返す単一の所感をそのまま表示する。`historyOpen`のstate、および履歴セクション(L192-225相当、「過去の所感を見る」ボタンとその中身)を削除する。`periodStartDate`/`periodEndDate`のpropsは`CommentAiAssist`へのAI生成集計範囲として維持する。`npm run build`が通る
  - 依存: CM-007(同一コミット)
  - ロールバック: CM-007とセットでこのコミットをrevertする。フェーズ2未適用であればDBへの追加変更なしに旧UIへ即座に戻せる
  - 完了: コミット`aaf30f8`(CM-007と同一コミット)

- [x] **CM-009** `mockups/comment.html`を更新する
  - DoD: 「過去の所感を見る」セクションを削除したモックアップに更新し、対象期間の入力欄に「クラスごとに自動保存されます」旨の注記を追加する。ブラウザで開いて崩れずに表示される
  - 依存: なし(CM-008着手前に完了させておくことが望ましい)
  - ロールバック: モックアップのみのためrevert容易
  - 完了: コミット`90d42ec`

- [x] **CM-010** `app/(main)/comments/class/[[...id]]/ClassCommentsContent.tsx`を対象期間のクラス単位記憶に対応させる
  - DoD: L24-29相当の`useState("")`による期間管理を`useClassCommentPeriod(classId)`呼び出しに置き換える。開始日・終了日の入力欄の値変更で`updatePeriod`を呼ぶ。終了日が開始日より前の場合は終了日欄にインラインエラー(「開始日は終了日より前の日付にしてください」)を表示し、自動保存を実行しない
  - 依存: CM-006, CM-009
  - ロールバック: このコミットをrevertすれば期間はローカルstateのみの管理(画面遷移でリセットされる旧挙動)に戻る。`class`テーブルの新規カラム自体は残るが未使用カラムとして無害
  - 完了: コミット`583e332`(表示不整合の追加修正がコミット`f9748a3`にあり)

- [x] **CM-011** `e2e/comments-class.spec.ts`を新仕様に更新する
  - DoD: 履歴閲覧に関するケースを削除し、「対象期間の自動保存」「クラス切り替え時の対象期間の復元」「開始日>終了日のバリデーション」のケースを追加する。`npm run test:e2e`が通る
  - 依存: CM-008, CM-010
  - ロールバック: テスト変更のみrevertする
  - 完了: コミット`e72f8ba`

- [x] **CM-012** `docs/features/comments/test-cases.md`を更新する
  - DoD: 対象期間の自動保存・所感の単一化・バリデーションのP0/P1テストケースが追記され、履歴閲覧のケースが削除される
  - 依存: CM-011
  - ロールバック: ドキュメントのみのため無条件にrevert可能
  - 完了: コミット`b2cc757`

- [x] **CM-013** 本番へフェーズ1マイグレーション(CM-002, CM-003相当)を適用し、新コードをデプロイする
  - DoD: 本番DBの`student_comment`件数・生徒あたり最大所感件数を事前確認したうえで、CM-001の手順でバックアップを取得してからフェーズ1マイグレーションを本番適用する。適用後、Vercelへ新コードをデプロイし、所感の保存・表示、対象期間の自動保存・クラスごとの復元、AI生成が本番環境で正常に動作することを手動確認する
  - 依存: CM-004, CM-005, CM-008, CM-010, CM-011がすべてマージ済みであること
  - ロールバック: フェーズ2未適用の段階であれば、Vercelのデプロイを前バージョンに戻すだけで完全復旧する(period列はNOT NULLが外れているだけでまだ存在し、データも削除されていないため)
  - 完了(2026-09-17確認): 本番DB(`aws-0-ap-northeast-1.pooler.supabase.com`経由でSession poolerに接続して確認)の`supabase_migrations.schema_migrations`に`20260911083009_class_comment_period`・`20260911083015_student_comment_expand`の適用記録が既にあり、スキーマも新仕様(`student_comment`に`unique(student_id)`制約あり、`period_start_date`/`period_end_date`はnullable、`class`に`comment_period_start_date`/`comment_period_end_date`あり)になっていることを直接確認した。マイグレーションは本タスク実施前に(おそらくT-005/T-079の本番セットアップ時に)既に適用済みだったため、本セッションでの追加のマイグレーション適用・バックアップ操作は不要だった(`student_comment`は本番に1件のみで、DEDUP DELETEの対象行もなかった)。Vercelへのデプロイ自体はGitHub連携の自動デプロイに委ねており(T-005)、本セッションからは個別のデプロイ操作・本番UIでの動作確認は行っていない。本番での実際の保存・AI生成の動作確認は必要であれば別途行うこと

- [ ] **CM-014(段階リリース・CM-013の数日後に実施)** `student_comment`フェーズ2(縮小)マイグレーションを作成・本番適用する
  - DoD: CM-013のリリースが本番で数日以上安定稼働していることを確認する。適用前に`select conname from pg_constraint where conrelid = 'public.student_comment'::regclass and contype = 'u';`を本番DBに対して実行し、旧複合ユニーク制約が対象通り検出できることを確認する。その後、`pg_constraint`から動的に制約名を検索してdropする`do $$`ブロックと、`period_start_date`/`period_end_date`の`drop column`を含むマイグレーションを適用する
  - 依存: CM-013の安定稼働確認(目安として最低数日、明確な問い合わせ・不具合報告がないこと)
  - ロールバック: **このタスク適用後はコードロールバックのみでは復旧できない。** CM-001で検証した手順に従い、まずカラムを復元する新規マイグレーションを適用してから、CM-013取得時点のバックアップをリストアする
