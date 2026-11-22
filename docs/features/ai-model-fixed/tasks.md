# 実装タスク: AIモデルの選択をなくし、プロバイダとAPIキーだけで連携する

対応する設計は`docs/features/ai-model-fixed/design.md`、影響範囲は`docs/features/ai-model-fixed/impact.md`を参照。

ID接頭辞: `AM-`。DBスキーマは変更しないため、フェーズ分けは不要。

---

- [x] **AM-001** 要件・設計・影響範囲・タスク表を作成し、全体設計書を更新する
  - DoD: 本ディレクトリに`requirements.md`・`design.md`・`impact.md`・`tasks.md`が揃い、`docs/features/README.md`のAIプロバイダ設定の行にAM-のタスクIDが追記されている。`docs/requirements.md`・`docs/design.md`・`docs/data-model.md`・`docs/design/screens.md`・`docs/design/components.md`の本文がモデル選択のない仕様に書き換わっている
  - 依存: なし
  - ロールバック: revertのみ

- [x] **AM-002** `shared/ai-models.ts`を固定モデルに置き換え、スキーマから`model`を外す
  - DoD: `AI_MODEL`が3プロバイダ分定義され、`SUPPORTED_MODELS`・`DEFAULT_MODEL`・`isSupportedModel`がリポジトリ内に残っていない。`aiProviderSettingInputSchema`が`{ provider, apiKey }`になっている。`shared/ai-models.test.ts`が通る
  - 依存: なし
  - ロールバック: revertのみ

- [x] **AM-003** Honoのルートとアダプタを更新する
  - DoD: GET/PUTが`{ provider, hasKey }`を返し、PUTは`model`列に`AI_MODEL[provider]`を書く。生成は`model`列を読まず`AI_MODEL[provider]`を使う。`UNSUPPORTED_MODEL`がコードに残っていない。Anthropicアダプタが`max_tokens: 16000`とサーバー側フォールバックを送る。`lib/hono-server/services/ai-adapters/index.test.ts`が通る
  - 依存: AM-002
  - ロールバック: revertのみ(DB変更なし)

- [x] **AM-004** hooksと設定画面からモデル選択を削除する
  - DoD: 設定画面に「モデル」欄が表示されず、併記が「プロバイダ名 / 固定モデル名」になる。`npm run lint`・`npx tsc --noEmit`・`npm run build`が通る
  - 依存: AM-002
  - ロールバック: revertのみ

- [x] **AM-005** モックアップ・マニュアルを更新する
  - DoD: `mockups/settings.html`からモデル選択欄が消え、`docs/manual/index.html`・`public/manual/index.html`の手順・画面一覧からモデル選択の記述が消えている。`docs/manual/capture/capture.spec.ts`の注記対象から「モデル」欄が外れている
  - 依存: なし
  - ロールバック: revertのみ

- [x] **AM-006** E2Eテストと画面別テストケースを更新する
  - DoD: `e2e/settings-ai-provider.spec.ts`がモデル選択のない仕様に沿っており、`npm run test:e2e`が通る(82件通過。うち4件は本改修と無関係な画面で再試行後に通過)。`docs/features/settings-ai-provider/test-cases.md`・`docs/features/ui-clarity/test-cases.md`のモデル選択に関するケースが更新・削除され、IDが連番になっている
  - 依存: AM-004
  - ロールバック: revertのみ

- [ ] **AM-007** 本番に反映する
  - DoD: PRをmasterにマージし、Vercelの本番デプロイが成功している。本番の設定画面にモデル欄が表示されないことを確認する。マイグレーションはないため`supabase db push`は不要
  - 依存: AM-001〜AM-006
  - ロールバック: マージコミットをrevertして再デプロイ
