import { describe, expect, it } from "vitest";
import { isTimetableGridText, parseTimetableGridRows } from "./parse-timetable-grid-rows";

describe("isTimetableGridText", () => {
  it("1行目が5列ならグリッド形式と判定する", () => {
    expect(isTimetableGridText("国語\t国語\t国語\t国語\t国語")).toBe(true);
  });

  it("3列(bulk長形式)はグリッド形式と判定しない", () => {
    expect(isTimetableGridText("曜日,時限,科目名\n月,1,国語")).toBe(false);
  });

  it("4列(per-class長形式)はグリッド形式と判定しない", () => {
    expect(isTimetableGridText("曜日,時限,科目名,クラス名\n月,1,国語,1年1組")).toBe(false);
  });

  it("空文字列はグリッド形式と判定しない", () => {
    expect(isTimetableGridText("")).toBe(false);
  });
});

describe("parseTimetableGridRows", () => {
  it("行=時限・列=曜日としてParsedTimetableRowへ変換する(タブ区切り)", () => {
    const raw = ["国語\t国語\t国語\t国語\t国語", "算数\t算数\t算数\t算数\t算数"].join("\n");
    const rows = parseTimetableGridRows(raw);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ weekdayLabel: "月", period: 1, subjectName: "国語", className: null });
    expect(rows[4]).toEqual({ weekdayLabel: "金", period: 1, subjectName: "国語", className: null });
    expect(rows[5]).toEqual({ weekdayLabel: "月", period: 2, subjectName: "算数", className: null });
  });

  it("カンマ区切りにも対応する", () => {
    const rows = parseTimetableGridRows("国語,算数,理科,社会,英語");
    expect(rows[1]).toEqual({ weekdayLabel: "火", period: 1, subjectName: "算数", className: null });
  });

  it("空セルはsubjectNameがnullになる", () => {
    const rows = parseTimetableGridRows("国語,,理科,社会,英語");
    expect(rows[1].subjectName).toBeNull();
  });

  it("空行はスキップする", () => {
    const rows = parseTimetableGridRows("国語,算数,理科,社会,英語\n\n");
    expect(rows).toHaveLength(5);
  });
});
