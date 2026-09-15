# 実装タスク: 時間割マスタ CSV/貼り付け取り込み

対応する設計は`docs/features/timetable-master/design.md`、影響範囲は`docs/features/timetable-master/impact.md`を参照。

ID接頭辞: `TM-`。破壊的変更・DBスキーマ変更を伴わない機能のため、互換性レイヤー用タスクは置かない。フィーチャーフラグ等の段階リリース用タスクも置かない(理由: 新規テーブル・新規カラムがなく、失敗時は当該コミットのrevertのみで完全に復旧できるため、段階公開の必要性がない)。

順序: モックアップ → フロントエンド基盤(パース・検証の純粋関数) → 既存コンポーネントの汎用化 → UI統合 → テスト。

**完了(2026-09-15確認)**: 以下TM-001〜TM-007はすべてコミット`b7dc79e`(「時間割マスタにCSV/貼り付け一括取り込みを追加(TM-001〜TM-007)」、E2Eの追加修正はコミット`41983ec`)で実装済み。チェックボックスが未更新のまま残っていたため、実態に合わせて更新した。なお、一括モードのCSV/貼り付け形式は2026-09-15にグリッド形式(曜日5列×時限6行)へ変更され、当時のTM-002/TM-006が対象としていた「曜日,時限,科目名」3列形式は廃止済み(`shared/parse-timetable-grid-rows.ts`、`e2e/timetable-master.spec.ts`参照)。

---

- [x] **TM-001** `mockups/timetable-master.html`にCSV/貼り付け取り込みセクションのモックアップを追加する
  - DoD: 既存のグリッド表の直前に、折りたたみ式の取り込みセクション(ファイルアップロード/テキスト貼り付けの切替、「取り込む」ボタン、エラー一覧の表示例)を追加し、ブラウザで開いて崩れずに表示される。`docs/design/design-system.md`のトークンのみを使う
  - 依存: なし
  - ロールバック: このファイルのみのコミットをrevertする。実装コードへの影響なし

- [x] **TM-002** `shared/parse-timetable-rows.ts`を実装する
  - DoD: `parseTimetableRows(rawText, mode)`がヘッダー行を除去し、カンマ/タブを自動判定して行配列を返す。`shared/parse-timetable-rows.test.ts`で正常系・区切り文字混在・空行スキップのケースが通り、`npm run test`が通る
  - 依存: なし
  - ロールバック: 追加した実装・テストファイルを削除するコミットをrevertする。他ファイルから未参照のため影響なし

- [x] **TM-003** `shared/timetable-csv-validation.ts`を実装する
  - DoD: `validateTimetableCsvRows()`が名前解決(科目名・クラス名の完全一致照合)・30マスの過不足チェック・同一マスの重複チェックを行い、全か無か方式で`TimetableCsvValidationResult`を返す。`shared/timetable-csv-validation.test.ts`で「正常系」「科目名不一致」「クラス名不一致」「行数不足」「行数超過」「同一マス重複」「1行に複数エラーが同時該当する場合に検証順で最初の理由のみ返す」の各ケースが通り、`npm run test`が通る
  - 依存: TM-002(`ParsedTimetableRow`型を使用)
  - ロールバック: 追加ファイルを削除するコミットをrevertする。他ファイルから未参照のため影響なし

- [x] **TM-004** `components/ui/PasteOrUploadArea.tsx`を汎用化し、既存の呼び出し元(生徒名簿)を追従させる
  - DoD: `PasteOrUploadAreaProps`に`reasonLabels`・`pasteLabel`・`fileInputAriaLabel`・`segmentedControlAriaLabel`を追加(デフォルト値なし、呼び出し元に明示を強制)。`app/(main)/students/page.tsx`が生徒名簿用の文言をpropsとして明示的に渡すよう更新する。`npm run build`が通り、既存の生徒名簿CSV取り込みのE2E(`e2e/students.spec.ts`等、該当するもの)が全て通る
  - 依存: なし(TM-002/003と並行可能)
  - ロールバック: コンポーネントと呼び出し元の変更は同一コミットに含めているため、このコミットを丸ごとrevertする(片方だけのrevertは型エラーになるため行わない)

- [x] **TM-005** `TimetableMasterForm.tsx`にCSV/貼り付け取り込みセクションを統合する
  - DoD: 折りたたみセクションが表示され、一括モードは3列(曜日,時限,科目名)、教科担任制モードは4列(曜日,時限,科目名,クラス名)を期待してパース・検証する。取り込み成功時に`draftSlots`・グリッド表示が更新される。取り込み失敗時はエラー一覧が表示され`draftSlots`は変更されない。一括モードでのCSV取り込み時、インポートされたスロットの`classId`は`null`のままでよい(既存の`buildPayload()`が一括モード時に常に`bulkClassId`で上書きするため)。手動で正常系・エラー系のCSVをアップロード・貼り付けして動作確認済み
  - 依存: TM-001(UIレイアウトの参照元)、TM-003、TM-004
  - ロールバック: このコミットをrevertすれば既存のグリッド手入力のみの画面に戻る。DB変更を伴わないため追加のデータ復旧作業は不要

- [x] **TM-006** `e2e/timetable-master.spec.ts`にCSV取り込みのE2Eケースを追加する
  - DoD: 「一括モードでの正常な取り込み」「教科担任制モードでの正常な取り込み」「科目名不一致エラー」「行数不足エラー」の最低4ケースが追加され、`npm run test:e2e`が通る
  - 依存: TM-005
  - ロールバック: 追加したテストケースのみrevertする。実装への影響なし

- [x] **TM-007** `docs/features/timetable-master/test-cases.md`を更新する
  - DoD: CSV/貼り付け取り込みのP0(必須)・P1(後で確認)のテストケースが追記される
  - 依存: TM-005
  - ロールバック: ドキュメントのみのため無条件にrevert可能
