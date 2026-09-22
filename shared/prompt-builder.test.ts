import { describe, expect, it } from "vitest";
import { buildPrompt, DEFAULT_LIFE_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE } from "./prompt-builder";

describe("buildPrompt", () => {
  it("プレースホルダーを学年・文字数・メモで置換する", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [
        { subjectName: "国語", noteDate: "2026-04-10", period: 1, content: "よく発言していた" },
        { subjectName: "算数", noteDate: "2026-04-11", period: 3, content: "計算が早い" },
      ],
      grade: "3",
      targetCharCount: 200,
      pseudonymCode: "1-03-10",
    });

    expect(result).toContain("学年：3");
    expect(result).toContain("最大文字数：200");
    expect(result).toContain("対象の児童・生徒：1-03-10");
    expect(result).toContain("- 2026-04-10 1時限 国語: よく発言していた");
    expect(result).toContain("- 2026-04-11 3時限 算数: 計算が早い");
    // 置換し漏れたプレースホルダーが残っていないこと
    expect(result).not.toContain("{{");
  });

  it("生活メモ(時限・科目なし)は日付と内容だけの行になる", () => {
    const result = buildPrompt({
      template: DEFAULT_LIFE_PROMPT_TEMPLATE,
      memos: [{ noteDate: "2026-04-10", content: "休み時間に下級生の面倒を見ていた" }],
      grade: "1",
      pseudonymCode: "1-03-10",
    });

    expect(result).toContain("生活所見を作成します");
    expect(result).toContain("- 2026-04-10: 休み時間に下級生の面倒を見ていた");
    // メモ行に時限・科目が入らないこと(ひな形の本文には「時限」の語が出るため、行の形で検証する)
    expect(result).not.toContain("- 2026-04-10 ");
    expect(result).not.toContain("{{");
  });

  it("メモが0件の場合は代替文言になる", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      pseudonymCode: "1-01-01",
    });
    expect(result).toContain("(該当期間の共有メモはありません)");
  });

  it("文字数が未指定の場合は「指定なし」になる", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      pseudonymCode: "1-01-01",
    });
    expect(result).toContain("最大文字数：指定なし");
  });

  it("学年が未指定・空白のみの場合は「指定なし」になる", () => {
    const notGiven = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      pseudonymCode: "1-01-01",
    });
    expect(notGiven).toContain("学年：指定なし");

    const blank = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      grade: "   ",
      pseudonymCode: "1-01-01",
    });
    expect(blank).toContain("学年：指定なし");
  });

  it("学年に「特支」が入る場合もそのまま埋め込まれる", () => {
    const result = buildPrompt({
      template: DEFAULT_PROMPT_TEMPLATE,
      memos: [],
      grade: "特支",
      pseudonymCode: "特-04-07",
    });
    expect(result).toContain("学年：特支");
  });

  it("ひな形に含まれないプレースホルダーがあってもエラーにならず、含まれるものだけ置換される", () => {
    const result = buildPrompt({
      template: "学年は{{grade}}。メモ:\n{{memos}}",
      memos: [{ noteDate: "2026-04-10", content: "テスト" }],
      grade: "2",
      targetCharCount: 100,
      pseudonymCode: "2-01-05",
    });
    expect(result).toBe("学年は2。メモ:\n- 2026-04-10: テスト");
  });

  it("教員が{{pseudonymCode}}を使い続けている場合も従来どおり置換される", () => {
    const result = buildPrompt({
      template: "生徒{{pseudonymCode}}について書いてください。",
      memos: [],
      pseudonymCode: "1-03-10",
    });
    expect(result).toBe("生徒1-03-10について書いてください。");
  });
});

describe("初期値のひな形", () => {
  it("学習・生活のいずれも必要なプレースホルダーを含む", () => {
    for (const template of [DEFAULT_PROMPT_TEMPLATE, DEFAULT_LIFE_PROMPT_TEMPLATE]) {
      expect(template).toContain("{{grade}}");
      expect(template).toContain("{{targetCharCount}}");
      expect(template).toContain("{{memos}}");
    }
  });

  it("学期の指定は含まない(本ツールに学期の概念がないため)", () => {
    for (const template of [DEFAULT_PROMPT_TEMPLATE, DEFAULT_LIFE_PROMPT_TEMPLATE]) {
      expect(template).not.toContain("学期");
    }
  });

  it("仮名コードのプレースホルダーを含む(教員が実名の非送信を目視確認できるようにするため)", () => {
    for (const template of [DEFAULT_PROMPT_TEMPLATE, DEFAULT_LIFE_PROMPT_TEMPLATE]) {
      expect(template).toContain("{{pseudonymCode}}");
    }
  });
});
