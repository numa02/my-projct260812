import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_MODEL } from "@/shared/ai-models";
import { aiAdapters, AiProviderError } from "./index";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

describe("aiAdapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("openai: モック環境でgenerateCommentを呼び出せる(T-029)", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: "生成された所見" } }] });
    const text = await aiAdapters.openai.generateComment({
      apiKey: "key",
      model: AI_MODEL.openai,
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所見");
  });

  it("anthropic: モック環境でgenerateCommentを呼び出せる(T-029)", async () => {
    mockFetchOnce(200, { content: [{ type: "text", text: "生成された所見" }] });
    const text = await aiAdapters.anthropic.generateComment({
      apiKey: "key",
      model: AI_MODEL.anthropic,
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所見");
  });

  it("gemini: モック環境でgenerateCommentを呼び出せる(T-029)", async () => {
    mockFetchOnce(200, { candidates: [{ content: { parts: [{ text: "生成された所見" }] } }] });
    const text = await aiAdapters.gemini.generateComment({
      apiKey: "key",
      model: AI_MODEL.gemini,
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所見");
  });

  it("anthropic: 考える処理の分を見込んだmax_tokensとサーバー側フォールバックを指定して送る", async () => {
    mockFetchOnce(200, {
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "生成された所見" },
      ],
    });
    const text = await aiAdapters.anthropic.generateComment({
      apiKey: "key",
      model: AI_MODEL.anthropic,
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所見");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: AI_MODEL.anthropic,
      max_tokens: 16000,
      fallbacks: "default",
    });
  });

  it("401はAUTH_ERRORとして扱われる", async () => {
    mockFetchOnce(401, {});
    await expect(
      aiAdapters.openai.generateComment({ apiKey: "key", model: AI_MODEL.openai, prompt: "p" }),
    ).rejects.toMatchObject({ code: "AUTH_ERROR" } satisfies Partial<AiProviderError>);
  });

  it("429はRATE_LIMITとして扱われる", async () => {
    mockFetchOnce(429, {});
    await expect(
      aiAdapters.anthropic.generateComment({
        apiKey: "key",
        model: AI_MODEL.anthropic,
        prompt: "p",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" } satisfies Partial<AiProviderError>);
  });
});
