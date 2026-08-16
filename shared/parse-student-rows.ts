export interface ParsedStudentRow {
  attendanceNumber: number | null;
  name: string | null;
}

/**
 * CSVアップロード・貼り付け共通のパース処理(F2)。
 * 列順は「出席番号,氏名」固定・ヘッダー行なし前提。区切り文字はカンマ/タブを自動判定する。
 * ここでは字句解析のみを行い、必須項目・重複のバリデーションはimport_students RPC側で行う。
 */
export function parseStudentRows(rawText: string): ParsedStudentRow[] {
  return rawText
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const delimiter = line.includes("\t") ? "\t" : ",";
      const [rawNumber, rawName] = line.split(delimiter);
      const trimmedNumber = (rawNumber ?? "").trim();
      const attendanceNumber = /^\d+$/.test(trimmedNumber) ? Number(trimmedNumber) : null;
      const name = (rawName ?? "").trim() || null;
      return { attendanceNumber, name };
    });
}
