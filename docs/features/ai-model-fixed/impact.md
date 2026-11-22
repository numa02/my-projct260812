# 影響範囲: AIモデルの選択をなくし、プロバイダとAPIキーだけで連携する

## 画面

| 画面 | 影響 |
|---|---|
| AIプロバイダ設定 | 「モデル」セレクトがなくなる。設定状況の併記が固定モデル名になる |
| 所見管理(AI直接生成) | 使われるモデルが固定モデルに変わる。操作は変わらない |

## コード

| ファイル | 影響 |
|---|---|
| `shared/ai-models.ts` | 許可リスト・既定モデルを廃止し、固定モデル`AI_MODEL`に置き換え |
| `shared/schemas/index.ts` | `aiProviderSettingInputSchema`から`model`を削除 |
| `lib/hono-server/routes/ai.ts` | GET/PUT/generateのモデルの扱いを変更、`UNSUPPORTED_MODEL`を削除 |
| `lib/hono-server/services/ai-adapters/anthropic.ts` | `max_tokens`引き上げとサーバー側フォールバックの指定 |
| `hooks/useAiProviderSettings.ts` | 型・保存入力から`model`を削除 |
| `app/(main)/settings/ai-provider/AiProviderSettingsForm.tsx` | モデル選択欄の削除、併記の変更 |

## ドキュメント

| ファイル | 影響 |
|---|---|
| `docs/requirements.md` | F9本文・非機能要件「AIプロバイダ連携」・用語「直接生成」・未決事項 |
| `docs/design.md` | §5.1 APIのコメント、§5.3 モデル名のバリデーション、エラーコード一覧 |
| `docs/data-model.md` | `AI_PROVIDER_SETTING.model`の意味 |
| `docs/design/screens.md`・`docs/design/components.md` | 設定画面の構成要素、セレクトの使用箇所 |
| `docs/features/settings-ai-provider/test-cases.md` | モデル選択に関するテストケースの更新・削除 |
| `docs/features/ui-clarity/test-cases.md` | 「長いモデル名」「未保存の選択」のケース |
| `docs/manual/index.html`・`public/manual/index.html` | 操作手順「モデルを選びます」の削除、画面一覧の説明 |
| `mockups/settings.html` | モデル選択欄の削除 |

## DB

変更なし。`ai_provider_setting.model`は残り、保存時に固定モデル名が書き込まれる(生成では読まない)。
