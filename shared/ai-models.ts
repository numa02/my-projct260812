export type AiProvider = "openai" | "anthropic" | "gemini";

/**
 * プロバイダごとの選択可能モデル許可リスト(要件定義書の未決事項に対応、T-030)。
 * 各社のモデルラインアップは頻繁に更新されるため、このリストは新モデルのリリースに
 * 合わせて手動更新する運用になる。実装時点(2026-08)で確認できた各社の中位モデルを
 * 既定値としているが、実際の提供状況は各プロバイダの公式ドキュメントで都度確認すること。
 */
export const SUPPORTED_MODELS: Record<AiProvider, readonly string[]> = {
  openai: ["gpt-5-nano", "gpt-5-mini", "gpt-5"],
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5"],
  gemini: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"],
};

/** コストと品質のバランスを重視した中位モデルを既定値とする(要件定義書 非機能要件) */
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-2.5-flash",
};

export function isSupportedModel(provider: AiProvider, model: string): boolean {
  return (SUPPORTED_MODELS[provider] as readonly string[]).includes(model);
}
