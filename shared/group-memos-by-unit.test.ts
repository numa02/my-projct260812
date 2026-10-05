import { describe, expect, it } from "vitest";
import { groupMemosByUnit, UNIT_UNSET_LABEL } from "./group-memos-by-unit";
import type { PromptMemo } from "./prompt-builder";

function memo(unitName: string | null | undefined, noteDate: string, content: string): PromptMemo {
  return { subjectName: "算数", unitName, noteDate, period: 1, content };
}

describe("groupMemosByUnit", () => {
  it("単元ごとにまとめ、最初に現れた順に並べる", () => {
    const groups = groupMemosByUnit([
      memo("分数のかけ算", "2026-04-10", "A"),
      memo("円の面積", "2026-04-12", "B"),
      memo("分数のかけ算", "2026-04-14", "C"),
    ]);

    expect(groups.map((g) => g.unitName)).toEqual(["分数のかけ算", "円の面積"]);
    expect(groups[0].memos.map((m) => m.content)).toEqual(["A", "C"]);
    expect(groups[1].memos.map((m) => m.content)).toEqual(["B"]);
    expect(groups.every((g) => g.isUnset === false)).toBe(true);
  });

  it("単元未設定のメモは常に最後のグループにまとめる", () => {
    const groups = groupMemosByUnit([
      memo(null, "2026-04-09", "X"),
      memo("分数のかけ算", "2026-04-10", "A"),
      memo(undefined, "2026-04-11", "Y"),
    ]);

    expect(groups.map((g) => g.unitName)).toEqual(["分数のかけ算", UNIT_UNSET_LABEL]);
    expect(groups[1].isUnset).toBe(true);
    expect(groups[1].memos.map((m) => m.content)).toEqual(["X", "Y"]);
  });

  it("空白のみの単元名は単元未設定として扱う", () => {
    const groups = groupMemosByUnit([memo("   ", "2026-04-10", "A")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].unitName).toBe(UNIT_UNSET_LABEL);
    expect(groups[0].isUnset).toBe(true);
  });

  it("単元未設定のメモが0件なら単元未設定のグループは作らない", () => {
    const groups = groupMemosByUnit([memo("分数のかけ算", "2026-04-10", "A")]);
    expect(groups.map((g) => g.unitName)).toEqual(["分数のかけ算"]);
  });

  it("メモが0件なら空配列を返す", () => {
    expect(groupMemosByUnit([])).toEqual([]);
  });

  it("入力の配列を破壊しない", () => {
    const memos = [memo("分数のかけ算", "2026-04-10", "A"), memo(null, "2026-04-11", "X")];
    groupMemosByUnit(memos);
    expect(memos).toHaveLength(2);
    expect(memos[0].content).toBe("A");
  });
});
