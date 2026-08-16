import { describe, expect, it } from "vitest";
import {
  addWeekdayOffset,
  computeWeekNumber,
  formatISODate,
  getWeekdayNumber,
  getWeekStartDate,
} from "./week";

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

describe("getWeekStartDate / formatISODate", () => {
  it("週の途中の日付からその週の月曜日を求められる", () => {
    const wednesday = new Date("2026-04-08T00:00:00+09:00");
    expect(formatISODate(getWeekStartDate(wednesday))).toBe("2026-04-06");
  });

  it("UTC時刻でJST日付境界をまたいでも正しい週の月曜日になる", () => {
    // UTC 2026-04-05T15:30:00Z は JSTで2026-04-06 00:30(月曜日)
    const date = new Date("2026-04-05T15:30:00Z");
    expect(formatISODate(getWeekStartDate(date))).toBe("2026-04-06");
  });
});

describe("addWeekdayOffset", () => {
  it("月曜日を起点にweekdayの日付を計算できる", () => {
    const monday = getWeekStartDate(new Date("2026-04-06T00:00:00+09:00"));
    expect(formatISODate(addWeekdayOffset(monday, 1))).toBe("2026-04-06"); // 月
    expect(formatISODate(addWeekdayOffset(monday, 5))).toBe("2026-04-10"); // 金
  });
});

describe("getWeekdayNumber", () => {
  it("月曜日は1、金曜日は5になる", () => {
    expect(getWeekdayNumber(new Date("2026-04-06T00:00:00+09:00"))).toBe(1);
    expect(getWeekdayNumber(new Date("2026-04-10T00:00:00+09:00"))).toBe(5);
  });

  it("土曜日は6、日曜日は0になる(時間割の対象外)", () => {
    expect(getWeekdayNumber(new Date("2026-04-11T00:00:00+09:00"))).toBe(6);
    expect(getWeekdayNumber(new Date("2026-04-12T00:00:00+09:00"))).toBe(0);
  });

  it("UTC時刻でJST日付境界をまたいでも正しい曜日になる", () => {
    // UTC 2026-04-05T15:30:00Z は JSTで2026-04-06 00:30(月曜日)
    expect(getWeekdayNumber(new Date("2026-04-05T15:30:00Z"))).toBe(1);
  });
});
