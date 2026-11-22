import { describe, expect, it } from "vitest";
import { AI_MODEL } from "./ai-models";

describe("ai-models", () => {
  it("3プロバイダそれぞれに固定モデルが定義されている", () => {
    for (const provider of ["openai", "anthropic", "gemini"] as const) {
      expect(AI_MODEL[provider].length).toBeGreaterThan(0);
    }
  });
});
