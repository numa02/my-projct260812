import { AiProviderError, type AiAdapter } from "./types";

export const geminiAdapter: AiAdapter = {
  async generateComment({ apiKey, model, prompt }) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError("AUTH_ERROR", "Geminiの認証に失敗しました");
    }
    if (response.status === 429) {
      throw new AiProviderError("RATE_LIMIT", "Geminiのレート制限に達しました");
    }
    if (!response.ok) {
      throw new AiProviderError(
        "PROVIDER_ERROR",
        `Gemini呼び出しに失敗しました(${response.status})`,
      );
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AiProviderError("PROVIDER_ERROR", "Geminiの応答が空でした");
    }
    return text;
  },
};
