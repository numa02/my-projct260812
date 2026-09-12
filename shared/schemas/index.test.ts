import { describe, expect, it } from "vitest";
import { commentSaveInputSchema, memoInputSchema, signupInputSchema } from "./index";

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
      content: "所感文",
      creationMethod: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("creationMethodが許可リスト外の場合は拒否する", () => {
    const result = commentSaveInputSchema.safeParse({
      content: "所感文",
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
