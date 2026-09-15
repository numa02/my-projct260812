import type { ParsedTimetableRow } from "./parse-timetable-rows";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金"];

function splitLine(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : ",";
  return line.split(delimiter).map((cell) => cell.trim());
}

/**
 * 時間割表をそのままコピーした「曜日5列×時限6行、科目名のみ」形式のテキストかどうかを判定する。
 * ヘッダー行・曜日/時限の明示列を持たないため、既存の「曜日,時限,科目名」形式(3列)・
 * 「曜日,時限,科目名,クラス名」形式(4列)とは1行あたりの列数(5列)で区別する。
 */
export function isTimetableGridText(rawText: string): boolean {
  const lines = rawText.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;
  return splitLine(lines[0]).length === WEEKDAY_LABELS.length;
}

/**
 * 時間割表形式(曜日5列×時限6行、科目名のみ)のテキストを、既存のCSV長形式と同じ
 * ParsedTimetableRowへ変換する(shared/timetable-csv-validation.tsの名前解決・完全性チェックを
 * そのまま再利用するため)。列位置が曜日・行位置が時限を表す。クラス名の列を持たないため
 * classNameは常にnull(一括モード専用の形式)。
 */
export function parseTimetableGridRows(rawText: string): ParsedTimetableRow[] {
  return rawText
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .flatMap((line, rowIndex) =>
      splitLine(line).map((cell, colIndex) => ({
        weekdayLabel: WEEKDAY_LABELS[colIndex] ?? null,
        period: rowIndex + 1,
        subjectName: cell || null,
        className: null,
      })),
    );
}
