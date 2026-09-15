/**
 * 時間割表形式(曜日ごとに列、時限ごとに行)で貼り付けられたテキストから、
 * 重複を除いた科目名の一覧を初出順で抽出する(科目の貼り付け一括登録用)。
 * 区切り文字はカンマ/タブを行ごとに自動判定する。列の位置(曜日)は無視し、全セルの値を対象にする。
 */
export function parseSubjectGridNames(rawText: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  rawText
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .forEach((line) => {
      const delimiter = line.includes("\t") ? "\t" : ",";
      line.split(delimiter).forEach((cell) => {
        const name = cell.trim();
        if (name.length === 0 || seen.has(name)) return;
        seen.add(name);
        names.push(name);
      });
    });

  return names;
}
