import { describe, expect, it } from "vitest";
import { computePseudonymCode } from "./pseudonym";

describe("computePseudonymCode", () => {
  it("通常学年の仮名コードを生成する", () => {
    expect(
      computePseudonymCode({ grade: "1", groupNumber: 3, attendanceNumber: 10 }),
    ).toBe("1-03-10");
  });

  it("特支クラスは学年部分が「特」になる", () => {
    expect(
      computePseudonymCode({ grade: "特支", groupNumber: 4, attendanceNumber: 7 }),
    ).toBe("特-04-07");
  });

  it("1桁の値は2桁ゼロ埋めされる", () => {
    expect(
      computePseudonymCode({ grade: "6", groupNumber: 1, attendanceNumber: 1 }),
    ).toBe("6-01-01");
  });

  it("2桁の値はそのまま使われる", () => {
    expect(
      computePseudonymCode({ grade: "3", groupNumber: 12, attendanceNumber: 34 }),
    ).toBe("3-12-34");
  });
});
