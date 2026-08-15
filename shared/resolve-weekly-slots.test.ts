import { describe, expect, it } from "vitest";
import { resolveWeeklySlots, type MasterSlot } from "./resolve-weekly-slots";

const master: MasterSlot[] = [
  { weekday: 1, period: 1, subjectId: "subject-a", classId: "class-a" },
  { weekday: 1, period: 2, subjectId: "subject-b", classId: "class-a" },
  { weekday: 2, period: 1, subjectId: null, classId: null },
];

describe("resolveWeeklySlots", () => {
  it("個別変更がないマスはマスタの内容をそのまま使う", () => {
    const result = resolveWeeklySlots(master, [], []);
    expect(result).toEqual([
      {
        weekday: 1,
        period: 1,
        subjectId: "subject-a",
        classId: "class-a",
        isSubjectOverridden: false,
        isClassOverridden: false,
      },
      {
        weekday: 1,
        period: 2,
        subjectId: "subject-b",
        classId: "class-a",
        isSubjectOverridden: false,
        isClassOverridden: false,
      },
      {
        weekday: 2,
        period: 1,
        subjectId: null,
        classId: null,
        isSubjectOverridden: false,
        isClassOverridden: false,
      },
    ]);
  });

  it("科目だけの個別変更はクラスに影響しない", () => {
    const result = resolveWeeklySlots(
      master,
      [{ weekday: 1, period: 1, subjectId: "subject-override" }],
      [],
    );
    const slot = result.find((s) => s.weekday === 1 && s.period === 1)!;
    expect(slot.subjectId).toBe("subject-override");
    expect(slot.classId).toBe("class-a"); // マスタのまま
    expect(slot.isSubjectOverridden).toBe(true);
    expect(slot.isClassOverridden).toBe(false);
  });

  it("クラスだけの個別変更は科目に影響しない", () => {
    const result = resolveWeeklySlots(
      master,
      [],
      [{ weekday: 1, period: 2, classId: "class-override" }],
    );
    const slot = result.find((s) => s.weekday === 1 && s.period === 2)!;
    expect(slot.subjectId).toBe("subject-b"); // マスタのまま
    expect(slot.classId).toBe("class-override");
    expect(slot.isClassOverridden).toBe(true);
  });

  it("科目の個別変更で「未設定(空きコマ)」(null)を表現できる", () => {
    const result = resolveWeeklySlots(
      master,
      [{ weekday: 1, period: 1, subjectId: null }],
      [],
    );
    const slot = result.find((s) => s.weekday === 1 && s.period === 1)!;
    expect(slot.subjectId).toBeNull();
    expect(slot.isSubjectOverridden).toBe(true);
  });
});
