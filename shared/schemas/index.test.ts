import { describe, expect, it } from "vitest";
import {
  commentKindSchema,
  commentSaveInputSchema,
  lifeMemoInputSchema,
  memoInputSchema,
  signupInputSchema,
} from "./index";

describe("memoInputSchema", () => {
  it("有効な入力を受け付ける", () => {
    const result = memoInputSchema.safeParse({
      studentId: "11111111-1111-4111-8111-111111111111",
      subjectId: "22222222-2222-4222-8222-222222222222",
      noteDate: "2026-04-10",
      period: 3,
      content: "よく発言していた",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shareFlag).toBe("shared"); // デフォルト値
    }
  });

  it("periodが範囲外の場合は拒否する", () => {
    const result = memoInputSchema.safeParse({
      studentId: "11111111-1111-4111-8111-111111111111",
      subjectId: "22222222-2222-4222-8222-222222222222",
      noteDate: "2026-04-10",
      period: 7,
      content: "内容",
    });
    expect(result.success).toBe(false);
  });

  it("contentが空文字の場合は拒否する", () => {
    const result = memoInputSchema.safeParse({
      studentId: "11111111-1111-4111-8111-111111111111",
      subjectId: "22222222-2222-4222-8222-222222222222",
      noteDate: "2026-04-10",
      period: 1,
      content: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("commentSaveInputSchema", () => {
  it("有効な入力を受け付ける", () => {
    const result = commentSaveInputSchema.safeParse({
      content: "所見文",
      creationMethod: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("creationMethodが許可リスト外の場合は拒否する", () => {
    const result = commentSaveInputSchema.safeParse({
      content: "所見文",
      creationMethod: "auto",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupInputSchema", () => {
  it("schoolLevelを指定しなくても有効(未選択がデフォルト)", () => {
    const result = signupInputSchema.safeParse({
      email: "teacher@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schoolLevel).toBeUndefined();
    }
  });

  it("schoolLevelにelementaryを指定できる", () => {
    const result = signupInputSchema.safeParse({
      email: "teacher@example.com",
      password: "password123",
      schoolLevel: "elementary",
    });
    expect(result.success).toBe(true);
  });

  it("schoolLevelにmiddleを指定できる", () => {
    const result = signupInputSchema.safeParse({
      email: "teacher@example.com",
      password: "password123",
      schoolLevel: "middle",
    });
    expect(result.success).toBe(true);
  });

  it("schoolLevelに不正な値を指定すると拒否する", () => {
    const result = signupInputSchema.safeParse({
      email: "teacher@example.com",
      password: "password123",
      schoolLevel: "high",
    });
    expect(result.success).toBe(false);
  });
});

describe("lifeMemoInputSchema", () => {
  const base = {
    studentId: "11111111-1111-4111-8111-111111111111",
    noteDate: "2026-04-10",
    content: "休み時間に下級生の面倒を見ていた",
  };

  it("科目・時限なしの入力を受け付け、共有区分の既定値はshared", () => {
    const result = lifeMemoInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data?.shareFlag).toBe("shared");
  });

  it("日付が空なら拒否する", () => {
    const result = lifeMemoInputSchema.safeParse({ ...base, noteDate: "" });
    expect(result.success).toBe(false);
  });

  it("内容が空白のみなら拒否する", () => {
    const result = lifeMemoInputSchema.safeParse({ ...base, content: "   " });
    expect(result.success).toBe(false);
  });
});

describe("commentKindSchema", () => {
  it("learning・lifeのみを受け付ける", () => {
    expect(commentKindSchema.safeParse("learning").success).toBe(true);
    expect(commentKindSchema.safeParse("life").success).toBe(true);
    expect(commentKindSchema.safeParse("other").success).toBe(false);
  });
});
