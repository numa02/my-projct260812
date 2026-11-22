# 設計: AIモデルの選択をなくし、プロバイダとAPIキーだけで連携する

要件は`docs/features/ai-model-fixed/requirements.md`を参照。

## データモデル

**スキーマ変更なし(マイグレーションなし)。** `ai_provider_setting.model text not null`は残す。

- 保存時(`PUT /api/settings/ai-provider`)は、サーバーが`AI_MODEL[provider]`を`model`列に書き込む。NOT NULL制約を満たしつつ、「保存した時点の固定モデル」の記録として残る
- 生成時(`POST /api/comments/generate`)は`model`列を**読まない**。常にその時点の`AI_MODEL[provider]`を使う。これにより、過去に別のモデルを保存した教員や、固定モデルを更新した後の既存設定も、再保存なしで新しいモデルに切り替わる
- 列削除は破壊的変更のため本改修では行わない(行う場合は`.claude/skills/feature-change/SKILL.md`の2フェーズ方式で別PR)

## shared

`shared/ai-models.ts`

```ts
export type AiProvider = "openai" | "anthropic" | "gemini";

/** プロバイダごとに所見生成で使うモデル。教員は選ばず、各社の廃止・後継に合わせてここだけを更新する */
export const AI_MODEL: Record<AiProvider, string> = {
  openai: "gpt-6.1-terra",
  anthropic: "claude-sonnet-5-5",
  gemini: "gemini-3.8-flash",
};
```

`SUPPORTED_MODELS`・`DEFAULT_MODEL`・`isSupportedModel`は削除する。

`shared/schemas`の`aiProviderSettingInputSchema`から`model`を削除する(`{ provider, apiKey }`)。zodは未知のキーを既定で取り除くため、デプロイ直後に旧画面から`model`付きで送られても保存は成功する。

## API(Hono。秘密情報を扱うため既存のエンドポイントを維持)

| エンドポイント | 変更 |
|---|---|
| `GET /settings/ai-provider` | 返却を`{ provider, hasKey }`にする(`model`を返さない) |
| `PUT /settings/ai-provider` | 入力を`{ provider, apiKey }`にする。`model`列には`AI_MODEL[provider]`を書き込む。許可リスト照合と`UNSUPPORTED_MODEL`エラーを削除する。返却は`{ provider, hasKey }` |
| `POST /comments/generate` | `ai_provider_setting`から`provider, encrypted_api_key`だけを読み、`AI_MODEL[provider]`でアダプタを呼ぶ |

### Anthropicアダプタ

`claude-sonnet-5-5`は考える処理(adaptive thinking)が既定で有効で、その出力も`max_tokens`に数えられる。従来の`max_tokens: 2048`では所見本文の前に上限へ達するおそれがあるため、`16000`(非ストリーミングの推奨値)に引き上げる。あわせて、安全分類器による辞退(`stop_reason: "refusal"`)時に別モデルで自動再実行するサーバー側フォールバック(`anthropic-beta: server-side-fallback-2026-07-01` + `fallbacks: "default"`)を有効にする。応答から`type: "text"`のブロックだけを取り出す既存処理は変えない(考える処理のブロックは無視される)。

OpenAI・Geminiのアダプタは、モデル名以外のリクエスト形式を変えない。

## 画面

`app/(main)/settings/ai-provider/AiProviderSettingsForm.tsx`

- 「モデル」セレクトを削除する
- 設定状況の併記は「{プロバイダ名} / {AI_MODEL[保存済みプロバイダ]}」とする(実際に生成で使うモデルを表示する。DBの`model`列は表示に使わない)

## エラーハンドリング

`UNSUPPORTED_MODEL`は発生しなくなるため、エラーコード一覧から削除する。その他は変更なし。

## 影響を受ける既存テスト

| テスト | 変更 |
|---|---|
| `shared/ai-models.test.ts` | 許可リストのテストを、3プロバイダに固定モデルが定義されていることのテストに置き換える |
| `lib/hono-server/services/ai-adapters/index.test.ts` | テスト内のモデル名を`AI_MODEL`の値に置き換える。Anthropicのリクエストに`max_tokens: 16000`・フォールバック指定が含まれることを確認するケースを追加 |
| `e2e/settings-ai-provider.spec.ts` | モデル選択の操作・アサーションを削除し、併記が固定モデル名になることを確認する。「プロバイダを切り替えるとモデルが既定に戻る」テストは、モデル選択欄が表示されないことの確認に置き換える |
| `docs/manual/capture/capture.spec.ts` | マニュアル用スクリーンショットの注記対象から「モデル」欄を外す |
| `tests/db/rls.test.ts`・`tests/db/rpc-export.test.ts` | `model`列は残るため変更なし |

## ロールバック

コードのrevertのみ。DBは変更しないため、旧コードに戻しても保存済みデータはそのまま読める(旧コードの許可リストにない`model`値=新しい固定モデル名が入っている教員は、旧画面では既定モデルが初期表示されるだけで、エラーにはならない。ただし旧コードの生成は`model`列の値をそのまま使う)。
