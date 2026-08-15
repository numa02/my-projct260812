/**
 * 仮名コード生成(F12): 学年1桁("特支"は"特")+組番号2桁ゼロ埋め+出席番号2桁ゼロ埋めをハイフンで連結。
 * 例: 1年生・組番号3・出席番号10番 → "1-03-10"、特支クラス・組番号4・出席番号7番 → "特-04-07"
 */
export function computePseudonymCode(input: {
  grade: string;
  groupNumber: number;
  attendanceNumber: number;
}): string {
  const gradeCode = input.grade === "特支" ? "特" : input.grade;
  const groupCode = String(input.groupNumber).padStart(2, "0");
  const attendanceCode = String(input.attendanceNumber).padStart(2, "0");
  return `${gradeCode}-${groupCode}-${attendanceCode}`;
}
