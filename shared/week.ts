import { differenceInCalendarDays, startOfWeek } from "date-fns";
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
