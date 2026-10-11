import { describe, expect, it } from "vitest";
import { resolvePromptTemplateKey } from "./prompt-template-key";

describe("resolvePromptTemplateKey", () => {
  it("学習の所見は生成単位でひな形が分かれる", () => {
    expect(resolvePromptTemplateKey("learning", "whole")).toBe("learning");
    expect(resolvePromptTemplateKey("learning", "per_unit")).toBe("learning_unit");
  });

  it("総合の所見も生成単位でひな形が分かれる", () => {
    expect(resolvePromptTemplateKey("general", "whole")).toBe("general");
    expect(resolvePromptTemplateKey("general", "per_unit")).toBe("general_unit");
  });

  it("生活の所見は生成単位によらずlifeになる(単元を持たないため)", () => {
    expect(resolvePromptTemplateKey("life", "whole")).toBe("life");
    expect(resolvePromptTemplateKey("life", "per_unit")).toBe("life");
  });
});
