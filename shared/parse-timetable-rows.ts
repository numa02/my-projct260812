export interface ParsedTimetableRow {
  weekdayLabel: string | null;
  period: number | null;
  subjectName: string | null;
  className: string | null;
}

/**
 * CSVアップロード・貼り付け共通のパース処理(時間割マスタ取り込み)。
 * 1行目はヘッダー行として無視する。区切り文字はカンマ/タブを自動判定する
 * (shared/parse-student-rows.tsと同じ方式)。列順はbulkモードで「曜日,時限,科目名」、
 * per-classモードで「曜日,時限,科目名,クラス名」固定。
 * ここでは字句解析のみを行い、名前解決・完全性チェックはshared/timetable-csv-validation.tsで行う。
 */
export function parseTimetableRows(
  rawText: string,
  mode: "bulk" | "per-class",
): ParsedTimetableRow[] {
  const lines = rawText
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .slice(1); // ヘッダー行を除去

  return lines.map((line) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const [rawWeekday, rawPeriod, rawSubjectName, rawClassName] = cells;

    const weekdayLabel = rawWeekday || null;
    const period = /^\d+$/.test(rawPeriod ?? "") ? Number(rawPeriod) : null;
    const subjectName = rawSubjectName || null;
    const className = mode === "per-class" ? rawClassName || null : null;

    return { weekdayLabel, period, subjectName, className };
  });
}
