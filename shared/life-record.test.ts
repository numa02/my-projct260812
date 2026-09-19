import { describe, expect, it } from "vitest";
import { resolveLifeRecordClassCandidates } from "./life-record";

const ALL = ["c1", "c2", "c3"];

describe("resolveLifeRecordClassCandidates", () => {
  it("その日に登場するクラスが1つだけなら、そのクラスに確定する(担任クラス)", () => {
    const slots = [
      { weekday: 1, classId: "c1" },
      { weekday: 1, classId: "c1" },
      { weekday: 1, classId: null },
      { weekday: 2, classId: "c2" },
    ];
    expect(resolveLifeRecordClassCandidates(slots, 1, ALL)).toEqual({ kind: "fixed", classId: "c1" });
  });

  it("その日に2つ以上のクラスが登場する(教科担任制)なら、その日のクラスだけを登場順に候補にする", () => {
    const slots = [
      { weekday: 3, classId: "c2" },
      { weekday: 3, classId: "c1" },
      { weekday: 3, classId: "c2" },
      { weekday: 4, classId: "c3" },
    ];
    expect(resolveLifeRecordClassCandidates(slots, 3, ALL)).toEqual({
      kind: "select",
      candidateIds: ["c2", "c1"],
    });
  });

  it("その日にクラスが1つも登場しない(時間割未設定・土日)なら、全クラスを候補にする", () => {
    const slots = [{ weekday: 1, classId: "c1" }];
    expect(resolveLifeRecordClassCandidates(slots, 6, ALL)).toEqual({ kind: "select", candidateIds: ALL });
    expect(resolveLifeRecordClassCandidates([], 1, ALL)).toEqual({ kind: "select", candidateIds: ALL });
  });
});
