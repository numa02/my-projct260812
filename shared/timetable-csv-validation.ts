import type { ParsedTimetableRow } from "./parse-timetable-rows";
import type { MasterSlotState } from "@/hooks/useTimetableMaster";

const WEEKDAY_MAP: Record<string, number> = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5 };
const REQUIRED_SLOT_COUNT = 30;

export type TimetableCsvErrorReason =
  | "INVALID_WEEKDAY"
  | "INVALID_PERIOD"
  | "SUBJECT_NOT_FOUND"
  | "CLASS_NOT_FOUND"
  | "DUPLICATE_SLOT"
  | "INCOMPLETE";

export interface TimetableCsvError {
  /** INCOMPLETEはファイル全体に対するエラーのため、rowIndexを持たない */
  rowIndex?: number;
  reason: TimetableCsvErrorReason;
}

export interface TimetableCsvValidationResult {
  ok: boolean;
  slots: MasterSlotState[];
  errors: TimetableCsvError[];
}

/**
 * パース済みの行を、登録済みsubjects/classesと突き合わせて名前解決し、
 * 30マスの完全性・重複を検証する純粋関数。1件でもエラーがあればok:falseを返し、
 * slotsは空配列にする(全か無か方式)。rowIndexは1始まりのデータ行番号
 * (ヘッダー行を含めない)。1行が複数のエラー理由に同時に該当する場合は、
 * 曜日→時限→科目名/クラス名→重複の順で検証し、最初に失敗した理由のみを返す。
 */
export function validateTimetableCsvRows(
  rows: ParsedTimetableRow[],
  mode: "bulk" | "per-class",
  subjects: { id: string; name: string }[],
  classes: { id: string; displayName: string }[],
): TimetableCsvValidationResult {
  if (rows.length !== REQUIRED_SLOT_COUNT) {
    return { ok: false, slots: [], errors: [{ reason: "INCOMPLETE" }] };
  }

  const errors: TimetableCsvError[] = [];
  const slots: MasterSlotState[] = [];
  const seenSlotKeys = new Set<string>();

  rows.forEach((row, index) => {
    const rowIndex = index + 1;

    const weekday = row.weekdayLabel ? WEEKDAY_MAP[row.weekdayLabel] : undefined;
    if (!weekday) {
      errors.push({ rowIndex, reason: "INVALID_WEEKDAY" });
      return;
    }

    if (row.period === null || row.period < 1 || row.period > 6) {
      errors.push({ rowIndex, reason: "INVALID_PERIOD" });
      return;
    }

    const subject = row.subjectName ? subjects.find((s) => s.name === row.subjectName) : undefined;
    if (!subject) {
      errors.push({ rowIndex, reason: "SUBJECT_NOT_FOUND" });
      return;
    }

    let classId: string | null = null;
    if (mode === "per-class") {
      const klass = row.className ? classes.find((c) => c.displayName === row.className) : undefined;
      if (!klass) {
        errors.push({ rowIndex, reason: "CLASS_NOT_FOUND" });
        return;
      }
      classId = klass.id;
    }

    const slotKey = `${weekday}-${row.period}`;
    if (seenSlotKeys.has(slotKey)) {
      errors.push({ rowIndex, reason: "DUPLICATE_SLOT" });
      return;
    }
    seenSlotKeys.add(slotKey);

    slots.push({ weekday, period: row.period, subjectId: subject.id, classId });
  });

  if (errors.length > 0) {
    return { ok: false, slots: [], errors };
  }

  return { ok: true, slots, errors: [] };
}
