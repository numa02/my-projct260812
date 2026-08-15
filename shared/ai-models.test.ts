import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, isSupportedModel, SUPPORTED_MODELS } from "./ai-models";

describe("ai-models", () => {
  it("3プロバイダそれぞれに既定モデルと選択肢が定義されている", () => {
    for (const provider of ["openai", "anthropic", "gemini"] as const) {
      expect(SUPPORTED_MODELS[provider].length).toBeGreaterThan(0);
      expect(SUPPORTED_MODELS[provider]).toContain(DEFAULT_MODEL[provider]);
    }
  });

  it("許可リスト内のモデルはtrueを返す", () => {
    expect(isSupportedModel("openai", "gpt-5-mini")).toBe(true);
  });

  it("許可リスト外のモデルはfalseを返す", () => {
    expect(isSupportedModel("openai", "not-a-real-model")).toBe(false);
  });
});
