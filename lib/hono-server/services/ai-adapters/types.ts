export interface AiAdapter {
  generateComment(params: { apiKey: string; model: string; prompt: string }): Promise<string>;
}

/** AIプロバイダからの認証エラー・レート制限エラー。所感は保存せず直前の状態を維持する(F9) */
export class AiProviderError extends Error {
  constructor(
    public readonly code: "AUTH_ERROR" | "RATE_LIMIT" | "PROVIDER_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
