import { describe, expect, it } from "vitest";
import { computeWeekNumber } from "./week";

describe("computeWeekNumber", () => {
  it("起算日と同じ週は第1週になる", () => {
    // 2026-04-06は月曜日
    const startDate = new Date("2026-04-06T00:00:00+09:00");
    const targetDate = new Date("2026-04-10T00:00:00+09:00"); // 同じ週の金曜日
    expect(computeWeekNumber(startDate, targetDate)).toBe(1);
  });

  it("起算日が週の途中でも、その週が第1週になる", () => {
    // 起算日が水曜日でも、その週(月曜始まり)が第1週
    const startDate = new Date("2026-04-08T00:00:00+09:00"); // 水曜日
    const targetDate = new Date("2026-04-06T00:00:00+09:00"); // 同じ週の月曜日
    expect(computeWeekNumber(startDate, targetDate)).toBe(1);
  });

  it("翌週は第2週になる", () => {
    const startDate = new Date("2026-04-06T00:00:00+09:00");
    const targetDate = new Date("2026-04-13T00:00:00+09:00");
    expect(computeWeekNumber(startDate, targetDate)).toBe(2);
  });

  it("JST日付境界をまたぐUTC時刻でも正しく判定する", () => {
    // UTC 2026-04-05T15:30:00Z は JSTで2026-04-06 00:30(月曜日)
    const startDate = new Date("2026-04-06T00:00:00+09:00");
    const targetDate = new Date("2026-04-05T15:30:00Z");
    expect(computeWeekNumber(startDate, targetDate)).toBe(1);
  });

  it("起算日より前の週は0以下になる", () => {
    const startDate = new Date("2026-04-06T00:00:00+09:00");
    const targetDate = new Date("2026-03-30T00:00:00+09:00");
    expect(computeWeekNumber(startDate, targetDate)).toBe(0);
  });
});
