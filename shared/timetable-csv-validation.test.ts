import { describe, expect, it } from "vitest";
import { validateTimetableCsvRows } from "./timetable-csv-validation";
import type { ParsedTimetableRow } from "./parse-timetable-rows";

const WEEKDAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

const subjects = [
  { id: "subj-japanese", name: "国語" },
  { id: "subj-math", name: "算数" },
];
const classes = [
  { id: "class-1-1", displayName: "1年1組" },
  { id: "class-1-2", displayName: "1年2組" },
];

function build30Rows(overrides: Partial<ParsedTimetableRow>[] = []): ParsedTimetableRow[] {
  const rows: ParsedTimetableRow[] = [];
  for (const weekdayLabel of WEEKDAYS) {
    for (const period of PERIODS) {
      rows.push({ weekdayLabel, period, subjectName: "国語", className: "1年1組" });
    }
  }
  overrides.forEach((patch, i) => {
    rows[i] = { ...rows[i], ...patch };
  });
  return rows;
}

describe("validateTimetableCsvRows", () => {
  it("30マスすべて正しいper-classモードのデータはokになる", () => {
    const result = validateTimetableCsvRows(build30Rows(), "per-class", subjects, classes);
    expect(result.ok).toBe(true);
    expect(result.slots).toHaveLength(30);
    expect(result.errors).toHaveLength(0);
  });

  it("bulkモードではclassNameを検証せずclassIdはnullになる", () => {
    const rows = build30Rows().map((r) => ({ ...r, className: null }));
    const result = validateTimetableCsvRows(rows, "bulk", subjects, []);
    expect(result.ok).toBe(true);
    expect(result.slots.every((s) => s.classId === null)).toBe(true);
  });

  it("30行に満たない場合はINCOMPLETEでrowIndexを持たない", () => {
    const result = validateTimetableCsvRows(build30Rows().slice(0, 29), "per-class", subjects, classes);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([{ reason: "INCOMPLETE" }]);
    expect(result.slots).toHaveLength(0);
  });

  it("31行以上ある場合もINCOMPLETE", () => {
    const rows = [...build30Rows(), { weekdayLabel: "月", period: 1, subjectName: "国語", className: "1年1組" }];
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ reason: "INCOMPLETE" }]);
  });

  it("曜日が不正な行はINVALID_WEEKDAY", () => {
    const rows = build30Rows([{ weekdayLabel: "土" }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([{ rowIndex: 1, reason: "INVALID_WEEKDAY" }]);
  });

  it("時限が範囲外の行はINVALID_PERIOD", () => {
    const rows = build30Rows([{ period: 7 }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ rowIndex: 1, reason: "INVALID_PERIOD" }]);
  });

  it("科目名が登録済み一覧と一致しない行はSUBJECT_NOT_FOUND", () => {
    const rows = build30Rows([{ subjectName: "理科" }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ rowIndex: 1, reason: "SUBJECT_NOT_FOUND" }]);
  });

  it("per-classモードでクラス名が一致しない行はCLASS_NOT_FOUND", () => {
    const rows = build30Rows([{ className: "3年3組" }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ rowIndex: 1, reason: "CLASS_NOT_FOUND" }]);
  });

  it("同じ曜日・時限が重複する行はDUPLICATE_SLOT", () => {
    const rows = build30Rows();
    rows[1] = { ...rows[1], weekdayLabel: rows[0].weekdayLabel, period: rows[0].period };
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ rowIndex: 2, reason: "DUPLICATE_SLOT" }]);
  });

  it("1行に複数のエラー理由が該当する場合は検証順で最初の理由のみ返す(曜日不正が科目名不一致より優先)", () => {
    const rows = build30Rows([{ weekdayLabel: "土", subjectName: "理科" }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.errors).toEqual([{ rowIndex: 1, reason: "INVALID_WEEKDAY" }]);
  });

  it("全か無か: エラーが1件でもあればslotsは空配列", () => {
    const rows = build30Rows([{ subjectName: "理科" }]);
    const result = validateTimetableCsvRows(rows, "per-class", subjects, classes);
    expect(result.slots).toEqual([]);
  });
});
