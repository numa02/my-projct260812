# 実装タスク: 所見プロンプトの差し替えと学年の反映

対応する設計は`docs/features/prompt-revision/design.md`、影響範囲は`docs/features/prompt-revision/impact.md`を参照。

ID接頭辞: `PT-`。DBスキーマ・RPCの変更を伴わないため、マイグレーション・2フェーズ方式・互換性レイヤー用のタスクは置かない。保存済みのひな形を書き換えないため、データ移行用のタスクも置かない。

順序: `shared/`の純粋関数と単体テスト → フロントエンド統合(UI) → モックアップ → E2E → ドキュメント。

このPRは`docs/features/ui-clarity/`(UC-001〜UC-009、PR #22)のブランチに積んでいる。`docs/requirements.md`・`docs/design/screens.md`・`docs/features/README.md`を双方が触るため、衝突を避けるためにstacked PRとした。

---

- [x] **PT-001** `shared/prompt-builder.ts`の初期値を新しい文面に差し替える
  - DoD: `DEFAULT_PROMPT_TEMPLATE`(学習用)・`DEFAULT_LIFE_PROMPT_TEMPLATE`(生活用)が教員から提示された文面になっている。「学期」の行は削除されている。プレースホルダーが`{{grade}}`・`{{targetCharCount}}`・`{{memos}}`の記法になっており、提示された文面の`{学年}`・`{最大文字数}`・`{メモ一覧}`がすべて置き換わっている。【入力情報】の先頭に`{{pseudonymCode}}`(対象の児童・生徒)を置いている
  - 依存: なし
  - ロールバック: 定数2つを元の文面に戻す。保存済みのひな形には触れていないためデータ影響なし

- [x] **PT-002** `buildPrompt`に`grade`を追加する
  - DoD: `buildPrompt`が`grade?: string`を受け取り、`{{grade}}`を置換する。未指定・空文字・空白のみの場合は`"指定なし"`になる。`{{pseudonymCode}}`の置換処理は残っている。ひな形に含まれないプレースホルダーがあってもエラーにならない
  - 依存: なし
  - ロールバック: 引数と置換処理を削除する。`{{grade}}`が未置換のまま残るため、PT-001と併せてrevertする

- [x] **PT-003** `shared/prompt-builder.test.ts`にケースを追加する
  - DoD: `{{grade}}`が値で置換されるケース・空文字で「指定なし」になるケース・初期値の文面に必要なプレースホルダーが含まれていることの検証が追加され、`npm run test`が通る。初期値の文面全体を固定文字列で比較するアサーションは置かない(文面の微修正で落ちるのを避けるため)
  - 依存: PT-001, PT-002
  - ロールバック: テストのrevertのみ

- [x] **PT-004** 所見管理画面に学年入力欄を追加し、クラスの学年を既定値にする
  - DoD: `CommentAiAssist`が`classGrade` propを受け取り、目安文字数の隣に「学年」の`Input`(`type="text"`)が表示される。既定値が選択中クラスの`grade`(「1」〜「6」または「特支」)になる。教員が書き換えるとプロンプトに反映される。`StudentCommentRow`・`ClassCommentsContent`が`classGrade`を中継し、行の`key`に`selectedClass.id`が含まれてクラス切り替え時に再マウントされる。`docs/design/design-system.md`にない色・サイズ・余白を追加していない
  - 依存: PT-002
  - ロールバック: 各コンポーネントのrevertのみ。`class.grade`のデータには触れていない

- [x] **PT-005** プロンプトひな形編集画面のプレースホルダー案内を更新する
  - DoD: `PromptTemplateForm.tsx`の案内文に`{{grade}}`(学年)が加わっている。`{{targetCharCount}}`・`{{memos}}`の案内は維持され、`{{pseudonymCode}}`も使える旨は残っている
  - 依存: PT-001
  - ロールバック: 案内文のrevertのみ

- [x] **PT-006** モックアップを実装内容に合わせて更新する
  - DoD: `mockups/comment.html`のAI生成セクションに「学年」入力欄が追加され、`mockups/settings.html`のひな形編集欄の初期値・プレースホルダー案内が新しい文面に合っている
  - 依存: PT-004, PT-005
  - ロールバック: モックアップのrevertのみ。アプリの動作に影響しない

- [x] **PT-007** E2Eを追従・追加する
  - DoD: `e2e/settings-prompt-template.spec.ts`が新しい初期値の文面を前提に通る。`e2e/comments-class.spec.ts`に、学年欄の既定値がクラスの学年であること・プロンプトに学年が反映されることのアサーションが追加される。`npm run test:e2e`が通る
  - 依存: PT-004, PT-005
  - ロールバック: テストのrevertのみ

- [x] **PT-008** 全体設計書・要件定義書を更新する
  - DoD: `docs/requirements.md`(F9・F10)、`docs/design/screens.md`(画面12・画面13)、`docs/design.md`(プロンプト組み立ての記載があれば)が実装と一致する。学期という概念を導入していないこと・仮名コードが初期値に含まれること(教員が実名の非送信を目視確認するため)が要件側から読み取れる
  - 依存: PT-001, PT-004
  - ロールバック: ドキュメントのrevertのみ

- [x] **PT-009** テストケース表を更新する
  - DoD: `docs/features/prompt-revision/test-cases.md`が作成され、`docs/features/settings-prompt-template/test-cases.md`・`docs/features/comments/test-cases.md`の該当ケースが更新される。`docs/features/README.md`の実装済み一覧に本改修の行が追加される
  - 依存: PT-001, PT-004
  - ロールバック: ドキュメントのrevertのみ

- [x] **PT-010** 検証を通す
  - DoD: `npm run lint`・`npm run test`・`npx tsc --noEmit`・`npm run build`・`npm run test:e2e`がすべて通る。`git grep -n "未実装\|未反映\|予定" -- docs`に本改修に関する古い注記が残っていない
  - 依存: PT-001〜PT-009
  - ロールバック: 該当なし(検証タスク)
