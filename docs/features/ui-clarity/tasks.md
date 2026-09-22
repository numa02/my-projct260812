# 実装タスク: 画面表示の分かりにくさの解消

対応する設計は`docs/features/ui-clarity/design.md`、影響範囲は`docs/features/ui-clarity/impact.md`を参照。

ID接頭辞: `UC-`。DBスキーマ・RPCの変更を伴わないため、マイグレーション・2フェーズ方式・互換性レイヤー用のタスクは置かない。表示のみの変更で本番のデータに影響しないため、段階リリース用のフィーチャーフラグも置かない。

順序: フロントエンド基盤(hooks・共通コンポーネント) → UI統合 → モックアップ → 単体テスト・E2E追従 → ドキュメント。

同じPRに小学校標準科目セットへの教科「生活」の追加(`docs/features/subjects/tasks.md` SJ-011〜SJ-014)を含む。UC-001は教科「生活」の追加と同時に反映する必要がある(`docs/features/ui-clarity/impact.md`「同時に反映が必要な変更」参照)。

---

- [x] **UC-001** 生活メモの表示ラベルを「生活記録」にする
  - DoD: `hooks/useStudentMemos.ts`の`LIFE_MEMO_LABEL`が`"生活記録"`になり、`components/timetable/TimetableGrid.tsx`の生活行の`rowheader`テキストが`"生活記録"`になる。生徒別メモ一覧の日付順表示の行ラベル・教科別表示のグループ見出し・週次時間割の行見出しの3箇所に反映される
  - 依存: なし
  - ロールバック: 定数と文字列リテラルを元の`"生活"`に戻すだけでよい。ただし教科「生活」(SJ-011)が本番に反映済みの場合、戻すと教科別表示で両者が同一グループに混ざるため、SJ-011のロールバックと併せて判断する

- [x] **UC-002** クラス管理画面から組番号の表示を外す
  - DoD: `app/(main)/classes/page.tsx`の`columns`から`groupNumber`の列定義が削除され、カード表示の`meta`が学年のみになる。`hooks/useClasses.ts`の`ClassRow.groupNumber`と取得クエリは変更しない(他画面の仮名コード生成が依存しているため)。クラスの作成・学年変更・削除の操作が従来どおり動作する
  - 依存: なし
  - ロールバック: 列定義と`meta`の表記を戻すだけでよい。データ・採番には一切触れていないため副作用なし

- [x] **UC-003** AIプロバイダ設定の設定状況表示を目立たせる
  - DoD: `app/(main)/settings/ai-provider/AiProviderSettingsForm.tsx`で、「APIキー」ラベル+バッジの並びになり、登録済みは`variant="recorded"`(ドット付き)・未登録は`variant="neutral"`で描画される。登録済みの場合はプロバイダ名とモデル名が併記される。保存成功時に画面の再読み込みなしで「未設定」→「設定済み」に変わり、併記内容も更新される。バッジのラベル文字列は「設定済み」「未設定」のまま。`docs/design/design-system.md`にない色・サイズ・余白を追加していない
  - 依存: なし
  - ロールバック: 当該コンポーネントのrevertのみ。APIキーの保存・復号処理には触れていない

- [x] **UC-004** モックアップを実装内容に合わせて更新する
  - DoD: `mockups/class-management.html`(組番号の表記3箇所を削除)、`mockups/settings.html`(APIキー欄に設定状況バッジを追加)、`mockups/student-memo-list.html`(「生活」→「生活記録」)、`mockups/weekly-timetable.html`(生活行の行見出し)が実装と一致する
  - 依存: UC-001, UC-002, UC-003
  - ロールバック: モックアップのrevertのみ。アプリの動作に影響しない

- [x] **UC-005** 単体テストを追従させる
  - DoD: `components/timetable/TimetableGrid.test.tsx`の`rowheader { name: "生活" }`の参照2箇所が`"生活記録"`に更新され、`npm run test`が通る
  - 依存: UC-001
  - ロールバック: テストのrevertのみ

- [x] **UC-006** E2Eを追従・追加する
  - DoD: `e2e/life-shoken.spec.ts`の教科別グループ見出しの参照が`"生活記録"`に更新される。`e2e/classes.spec.ts`の「組番号が自動採番される」テストが「一覧に組番号が表示されない」ことの確認に置き換わる(採番規則の検証は`tests/db/rpc-class.test.ts`が継続して担う)。`e2e/settings-ai-provider.spec.ts`に、保存後にプロバイダ名・モデル名が併記されることを確認するアサーションが追加される。`npm run test:e2e`が通る
  - 依存: UC-001, UC-002, UC-003
  - ロールバック: テストのrevertのみ

- [x] **UC-007** 全体設計書・要件定義書を更新する
  - DoD: `docs/requirements.md`(F1用語集の「組番号」、F7の生活メモ表記、F9のAPIキー保存のThen)、`docs/design/screens.md`(画面5・画面10-2・画面11・画面13)、`docs/design/components.md`(Badgeのバリエーション)が実装と一致する。旧表記「生活」が残っていないことを`git grep`で確認する
  - 依存: UC-001, UC-002, UC-003
  - ロールバック: ドキュメントのrevertのみ

- [x] **UC-008** 各画面のテストケース表を更新する
  - DoD: `docs/features/ui-clarity/test-cases.md`が作成され、`docs/features/classes/test-cases.md`(TC-002・TC-104)・`docs/features/settings-ai-provider/test-cases.md`(TC-001・TC-002)・`docs/features/life-shoken/test-cases.md`(LS-P0-01・LS-P0-03)の該当ケースが更新される。`docs/features/memo-students-list/test-cases.md`は生活メモの表記に触れていないため変更不要。`docs/features/README.md`の実装済み一覧に本改修の行が追加される
  - 依存: UC-001〜UC-003(E2Eの追従UC-006とは独立に更新できる)
  - ロールバック: ドキュメントのrevertのみ

- [x] **UC-009** 検証を通す
  - DoD: `npm run lint`・`npm run test`・`npx tsc --noEmit`・`npm run build`・`npm run test:e2e`がすべて通る。`git grep -n "未実装\|未反映\|予定" -- docs`に本改修に関する古い注記が残っていない
  - 依存: UC-001〜UC-008、SJ-011〜SJ-014
  - ロールバック: 該当なし(検証タスク)
