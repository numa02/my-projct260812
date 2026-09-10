import { afterEach, describe, expect, it, vi } from "vitest";
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
    mockFetchOnce(200, { choices: [{ message: { content: "生成された所感" } }] });
    const text = await aiAdapters.openai.generateComment({
      apiKey: "key",
      model: "gpt-5-mini",
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所感");
  });

  it("anthropic: モック環境でgenerateCommentを呼び出せる(T-029)", async () => {
    mockFetchOnce(200, { content: [{ type: "text", text: "生成された所感" }] });
    const text = await aiAdapters.anthropic.generateComment({
      apiKey: "key",
      model: "claude-sonnet-5",
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所感");
  });

  it("gemini: モック環境でgenerateCommentを呼び出せる(T-029)", async () => {
    mockFetchOnce(200, { candidates: [{ content: { parts: [{ text: "生成された所感" }] } }] });
    const text = await aiAdapters.gemini.generateComment({
      apiKey: "key",
      model: "gemini-2.5-flash",
      prompt: "プロンプト",
    });
    expect(text).toBe("生成された所感");
  });

  it("401はAUTH_ERRORとして扱われる", async () => {
    mockFetchOnce(401, {});
    await expect(
      aiAdapters.openai.generateComment({ apiKey: "key", model: "gpt-5-mini", prompt: "p" }),
    ).rejects.toMatchObject({ code: "AUTH_ERROR" } satisfies Partial<AiProviderError>);
  });

  it("429はRATE_LIMITとして扱われる", async () => {
    mockFetchOnce(429, {});
    await expect(
      aiAdapters.anthropic.generateComment({
        apiKey: "key",
        model: "claude-sonnet-5",
        prompt: "p",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" } satisfies Partial<AiProviderError>);
  });
});
