# 実装タスク: 用語「所感」を「所見」に統一する

対応する設計は`docs/features/terminology-shoken/design.md`、影響範囲は`docs/features/terminology-shoken/impact.md`を参照。

ID接頭辞: `TS-`。表記のみの変更でDB変更を伴わないため、2フェーズ方式・互換性レイヤー用タスクは置かない。

---

- [x] **TS-001** 要件・設計・影響範囲・タスク表を作成する
  - DoD: 本ディレクトリに`requirements.md`・`design.md`・`impact.md`・`tasks.md`・`test-cases.md`が揃い、`docs/features/README.md`に1行追加されている
  - 依存: なし
  - ロールバック: ファイル削除のみ

- [x] **TS-002** アプリコード・テストの「所感」を「所見」に置き換える
  - DoD: `app/`・`components/`・`hooks/`・`lib/`・`shared/`・`tests/`・`e2e/`から「所感」が消えている(`git grep 所感`で確認)。`npm run lint`・`npm run test`・`npx tsc --noEmit`・`npm run build`が通る
  - 依存: TS-001
  - ロールバック: 該当コミットのrevertのみ(DB変更なし)

- [x] **TS-003** モックアップの「所感」を「所見」に置き換える
  - DoD: `mockups/*.html`から「所感」が消えている
  - 依存: なし
  - ロールバック: revertのみ

- [x] **TS-004** ドキュメント(`docs/`・`CLAUDE.md`・スキル定義)の「所感」を「所見」に置き換える
  - DoD: `supabase/migrations/`と本ディレクトリを除き、`git grep 所感`の結果が0件
  - 依存: なし
  - ロールバック: revertのみ

- [x] **TS-005** E2Eテストで文言変更後の画面を通しで確認する
  - DoD: ローカルSupabaseスタック起動のうえ`npm run test:e2e`が通る(全61件中60件成功。残り1件`comments-class.spec.ts:157`は単独実行で3回連続成功しており、全件実行時のみ失敗する既存の不安定テスト。途中で発見した既存のセレクタ不具合は`docs/bugs.md` BUG-005で修正)
  - 依存: TS-002
  - ロールバック: なし(確認のみ)
