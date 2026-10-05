import { describe, expect, it } from "vitest";
import { groupMemosBySubjectAndUnit } from "./group-memos-by-subject-unit";
import { UNIT_UNSET_LABEL } from "./group-memos-by-unit";

function memo(subjectName: string, unitName: string | null, content: string) {
  return { subjectName, unitName, content };
}

describe("groupMemosBySubjectAndUnit", () => {
  it("教科ごとにまとめ、最初に現れた順に並べる", () => {
    const groups = groupMemosBySubjectAndUnit([
      memo("算数", null, "A"),
      memo("国語", null, "B"),
      memo("算数", null, "C"),
    ]);

    expect(groups.map((g) => g.subjectName)).toEqual(["算数", "国語"]);
    expect(groups[0].memos.map((m) => m.content)).toEqual(["A", "C"]);
  });

  it("単元付きのメモが1件もない教科は小グループを作らない(従来の表示のまま)", () => {
    const groups = groupMemosBySubjectAndUnit([memo("国語", null, "A"), memo("国語", null, "B")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].unitGroups).toBeNull();
    expect(groups[0].memos.map((m) => m.content)).toEqual(["A", "B"]);
  });

  it("単元付きのメモがある教科は単元ごとの小グループに分かれる", () => {
    const groups = groupMemosBySubjectAndUnit([
      memo("算数", "分数のかけ算", "A"),
      memo("算数", "円の面積", "B"),
      memo("算数", "分数のかけ算", "C"),
    ]);

    expect(groups[0].unitGroups?.map((g) => g.unitName)).toEqual(["分数のかけ算", "円の面積"]);
    expect(groups[0].unitGroups?.[0].memos.map((m) => m.content)).toEqual(["A", "C"]);
  });

  it("単元未設定の小グループは単元付きの後に置く", () => {
    const groups = groupMemosBySubjectAndUnit([
      memo("算数", null, "X"),
      memo("算数", "分数のかけ算", "A"),
      memo("算数", null, "Y"),
    ]);

    expect(groups[0].unitGroups?.map((g) => g.unitName)).toEqual(["分数のかけ算", UNIT_UNSET_LABEL]);
    expect(groups[0].unitGroups?.[1].isUnset).toBe(true);
    expect(groups[0].unitGroups?.[1].memos.map((m) => m.content)).toEqual(["X", "Y"]);
  });

  it("単元の有無は教科ごとに判定する(単元がある教科だけ2段になる)", () => {
    const groups = groupMemosBySubjectAndUnit([
      memo("算数", "分数のかけ算", "A"),
      memo("国語", null, "B"),
    ]);

    expect(groups[0].unitGroups).not.toBeNull();
    expect(groups[1].unitGroups).toBeNull();
  });

  it("生活記録(単元を持たない)の教科グループには小グループを作らない", () => {
    const groups = groupMemosBySubjectAndUnit([
      memo("算数", "分数のかけ算", "A"),
      memo("生活記録", null, "L"),
    ]);

    expect(groups.find((g) => g.subjectName === "生活記録")?.unitGroups).toBeNull();
  });

  it("空白のみの単元名は単元未設定として扱う", () => {
    const groups = groupMemosBySubjectAndUnit([memo("算数", "   ", "A"), memo("算数", "円の面積", "B")]);

    expect(groups[0].unitGroups?.map((g) => g.unitName)).toEqual(["円の面積", UNIT_UNSET_LABEL]);
  });

  it("メモが0件なら空配列を返す", () => {
    expect(groupMemosBySubjectAndUnit([])).toEqual([]);
  });
});
