import { describe, expect, it } from "vitest";
import { buildPrompt, DEFAULT_LIFE_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE } from "./prompt-builder";

describe("buildPrompt", () => {
  it("プレースホルダーをメモ・文字数・仮名コードで置換する", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [
        { subjectName: "国語", noteDate: "2026-04-10", period: 1, content: "よく発言していた" },
        { subjectName: "算数", noteDate: "2026-04-11", period: 3, content: "計算が早い" },
      ],
      targetCharCount: 200,
      pseudonymCode: "1-03-10",
    });

    expect(result).toContain("生徒1-03-10について");
    expect(result).toContain("目安の文字数: 200文字");
    expect(result).toContain("- 2026-04-10 1時限 国語: よく発言していた");
    expect(result).toContain("- 2026-04-11 3時限 算数: 計算が早い");
  });

  it("生活メモ(時限・科目なし)は日付と内容だけの行になる", () => {
    const result = buildPrompt({
      template: DEFAULT_LIFE_PROMPT_TEMPLATE,
      memos: [{ noteDate: "2026-04-10", content: "休み時間に下級生の面倒を見ていた" }],
      pseudonymCode: "1-03-10",
    });

    expect(result).toContain("行動・生活面の所見文");
    expect(result).toContain("【生活メモ】");
    expect(result).toContain("- 2026-04-10: 休み時間に下級生の面倒を見ていた");
    expect(result).not.toContain("時限");
  });

  it("メモが0件の場合は代替文言になる", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      pseudonymCode: "1-01-01",
    });
    expect(result).toContain("(該当期間の共有メモはありません)");
  });

  it("目安文字数が未指定の場合は「指定なし」になる", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      pseudonymCode: "1-01-01",
    });
    expect(result).toContain("目安の文字数: 指定なし文字");
  });
});
