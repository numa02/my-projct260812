import { describe, expect, it } from "vitest";
import { parseStudentRows } from "./parse-student-rows";

describe("parseStudentRows", () => {
  it("カンマ区切りをパースする", () => {
    expect(parseStudentRows("1,生徒A\n2,生徒B")).toEqual([
      { attendanceNumber: 1, name: "生徒A" },
      { attendanceNumber: 2, name: "生徒B" },
    ]);
  });

  it("タブ区切りをパースする", () => {
    expect(parseStudentRows("1\t生徒A\n2\t生徒B")).toEqual([
      { attendanceNumber: 1, name: "生徒A" },
      { attendanceNumber: 2, name: "生徒B" },
    ]);
  });

  it("空行を無視する", () => {
    expect(parseStudentRows("1,生徒A\n\n2,生徒B\n")).toHaveLength(2);
  });

  it("出席番号が数値でない場合はnullになる", () => {
    expect(parseStudentRows("abc,生徒A")).toEqual([{ attendanceNumber: null, name: "生徒A" }]);
  });

  it("氏名が空の場合はnullになる", () => {
    expect(parseStudentRows("1,")).toEqual([{ attendanceNumber: 1, name: null }]);
  });
});
