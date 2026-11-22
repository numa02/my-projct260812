export type AiProvider = "openai" | "anthropic" | "gemini";

/**
 * プロバイダごとに所見生成で使うモデル(固定モデル。docs/features/ai-model-fixed/)。
 * 教員はモデルを選ばない。各社のモデル廃止・後継の提供に合わせてここだけを更新すれば、
 * 教員が設定を保存し直さなくても全員の生成が新しいモデルに切り替わる
 * (生成時はDBのai_provider_setting.modelを読まず、常にこの値を使う)。
 * 実際の提供状況は各プロバイダの公式ドキュメントで都度確認すること。
 *
 * 更新履歴:
 * - 2026-08: 教員が選ぶ方式で、各社の中位モデルを既定値として設定
 * - 2026-09: Gemini 2.5系の提供終了に伴い選択肢を更新
 * - 2026-11: モデル選択を廃止し固定モデルへ。gpt-5系(2026-12-11停止)・gemini-2.5系(2026-12-01停止)の
 *   後継として、各社の中位モデルを採用
 */
export const AI_MODEL: Record<AiProvider, string> = {
  openai: "gpt-6.1-terra",
  anthropic: "claude-sonnet-5-5",
  gemini: "gemini-3.8-flash",
};
