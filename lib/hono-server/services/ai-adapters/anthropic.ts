import { AiProviderError, type AiAdapter } from "./types";

export const anthropicAdapter: AiAdapter = {
  async generateComment({ apiKey, model, prompt }) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // 安全分類器が辞退した場合に、辞退の種類に応じた別モデルでサーバー側が自動で再実行する
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        // 考える処理(adaptive thinking)の出力もmax_tokensに数えられるため、所見本文が途中で切れないよう余裕を持たせる
        max_tokens: 16000,
        fallbacks: "default",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Anthropic API error (${response.status}):`, errorBody);

      if (response.status === 401 || response.status === 403) {
        throw new AiProviderError("AUTH_ERROR", "Anthropicの認証に失敗しました");
      }
      if (response.status === 429) {
        throw new AiProviderError("RATE_LIMIT", "Anthropicのレート制限に達しました");
      }
      throw new AiProviderError(
        "PROVIDER_ERROR",
        `Anthropic呼び出しに失敗しました(${response.status})`,
      );
    }

    const body = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = body.content?.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new AiProviderError("PROVIDER_ERROR", "Anthropicの応答が空でした");
    }
    return text;
  },
};
