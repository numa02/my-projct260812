import { AiProviderError, type AiAdapter } from "./types";

export const openaiAdapter: AiAdapter = {
  async generateComment({ apiKey, model, prompt }) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError("AUTH_ERROR", "OpenAIの認証に失敗しました");
    }
    if (response.status === 429) {
      throw new AiProviderError("RATE_LIMIT", "OpenAIのレート制限に達しました");
    }
    if (!response.ok) {
      throw new AiProviderError("PROVIDER_ERROR", `OpenAI呼び出しに失敗しました(${response.status})`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) {
      throw new AiProviderError("PROVIDER_ERROR", "OpenAIの応答が空でした");
    }
    return text;
  },
};
