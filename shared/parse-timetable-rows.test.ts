import { describe, expect, it } from "vitest";
import { parseTimetableRows } from "./parse-timetable-rows";

describe("parseTimetableRows", () => {
  it("bulkモードでヘッダー行を除去し3列をパースする", () => {
    const rows = parseTimetableRows("曜日,時限,科目名\n月,1,国語\n月,2,算数", "bulk");
    expect(rows).toEqual([
      { weekdayLabel: "月", period: 1, subjectName: "国語", className: null },
      { weekdayLabel: "月", period: 2, subjectName: "算数", className: null },
    ]);
  });

  it("per-classモードで4列をパースする", () => {
    const rows = parseTimetableRows(
      "曜日,時限,科目名,クラス名\n月,1,国語,1年1組",
      "per-class",
    );
    expect(rows).toEqual([
      { weekdayLabel: "月", period: 1, subjectName: "国語", className: "1年1組" },
    ]);
  });

  it("タブ区切りも自動判定する", () => {
    const rows = parseTimetableRows("曜日\t時限\t科目名\n月\t1\t国語", "bulk");
    expect(rows).toEqual([
      { weekdayLabel: "月", period: 1, subjectName: "国語", className: null },
    ]);
  });

  it("空行はスキップする", () => {
    const rows = parseTimetableRows("曜日,時限,科目名\n月,1,国語\n\n火,2,算数", "bulk");
    expect(rows).toHaveLength(2);
  });

  it("時限が数値でない場合はnullになる", () => {
    const rows = parseTimetableRows("曜日,時限,科目名\n月,一,国語", "bulk");
    expect(rows[0].period).toBeNull();
  });

  it("曜日・科目名が空欄の場合はnullになる", () => {
    const rows = parseTimetableRows("曜日,時限,科目名\n,1,", "bulk");
    expect(rows[0].weekdayLabel).toBeNull();
    expect(rows[0].subjectName).toBeNull();
  });
});
