export type AiProvider = "openai" | "anthropic" | "gemini";

/**
 * プロバイダごとの選択可能モデル許可リスト(要件定義書の未決事項に対応、T-030)。
 * 各社のモデルラインアップは頻繁に更新されるため、このリストは新モデルのリリースに
 * 合わせて手動更新する運用になる。実際の提供状況は各プロバイダの公式ドキュメントで都度確認すること。
 *
 * 更新履歴:
 * - 2026-08: 実装時点で確認できた各社の中位モデルを既定値として設定
 * - 2026-09: gemini-2.5-flash-liteが新規ユーザー向けに提供終了(404 NOT_FOUND)されたため、
 *   flash-lite/flashをGemini 3.5系に更新。gemini-3.5-proは本更新時点で未一般提供のため
 *   gemini-2.5-proを暫定維持(Gemini 2.5系は2026-10-16に正式廃止予定のため、それまでに
 *   3.5-proの提供状況を再確認して更新すること)
 */
export const SUPPORTED_MODELS: Record<AiProvider, readonly string[]> = {
  openai: ["gpt-5-nano", "gpt-5-mini", "gpt-5"],
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5"],
  gemini: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-pro"],
};

/** コストと品質のバランスを重視した中位モデルを既定値とする(要件定義書 非機能要件) */
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-3.5-flash",
};

export function isSupportedModel(provider: AiProvider, model: string): boolean {
  return (SUPPORTED_MODELS[provider] as readonly string[]).includes(model);
}
