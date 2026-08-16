import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const JST_TIME_ZONE = "Asia/Tokyo";

function jstMonday(date: Date): Date {
  return startOfWeek(toZonedTime(date, JST_TIME_ZONE), { weekStartsOn: 1 });
}

/**
 * 起算日を含む月曜始まりの週を第1週として、targetDateが第何週にあたるかをJST固定で計算する。
 */
export function computeWeekNumber(startDate: Date, targetDate: Date): number {
  const startMonday = jstMonday(startDate);
  const targetMonday = jstMonday(targetDate);
  const diffDays = differenceInCalendarDays(targetMonday, startMonday);
  return Math.floor(diffDays / 7) + 1;
}

/** dateが属する月曜始まりの週の月曜日(JST固定)を返す */
export function getWeekStartDate(date: Date): Date {
  return jstMonday(date);
}

/** weekStartDate(月曜日)からweekday(1=月〜5=金)だけ進めた日付を返す */
export function addWeekdayOffset(weekStartDate: Date, weekday: number): Date {
  return addDays(weekStartDate, weekday - 1);
}

/** Date(またはJST変換済みDate)を "yyyy-MM-dd" 形式に整形する */
export function formatISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** dateのJST基準の曜日番号を返す(0=日, 1=月, ..., 5=金, 6=土)。時間割は1〜5(月〜金)のみが対象 */
export function getWeekdayNumber(date: Date): number {
  return toZonedTime(date, JST_TIME_ZONE).getDay();
}

/** 現在時刻をJST基準の "yyyy-MM-dd" 文字列で返す */
export function getTodayISO(): string {
  return formatISODate(toZonedTime(new Date(), JST_TIME_ZONE));
}
