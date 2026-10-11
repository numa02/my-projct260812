/**
 * 貼り付けられたテキストから単元名の一覧を初出順で抽出する(単元の貼り付け一括登録用)。
 *
 * 科目の一括登録(`parseSubjectGridNames`)が時間割表の全セルを拾うのに対し、こちらは
 * **1行1単元**として扱う。教科書の目次や年間指導計画を貼る使い方を想定しているため、
 * タブ/カンマ区切りの行では先頭の列だけを単元名とし、2列目以降(時数など)は捨てる。
 * 区切り文字は行ごとにタブ優先で判定する(`parseSubjectGridNames`と同じ判定順)。
 *
 * 単元名に半角カンマ・タブが含まれているとそこで切れる(全角読点「、」は影響しない)。
 * これは既知の制約として`docs/features/memo-unit/design.md` §7に記載している。
 */
export function parseUnitNames(rawText: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  rawText
    .split(/\r\n|\r|\n/)
    .forEach((line) => {
      const delimiter = line.includes("\t") ? "\t" : ",";
      const name = line.split(delimiter)[0].trim();
      if (name.length === 0 || seen.has(name)) return;
      seen.add(name);
      names.push(name);
    });

  return names;
}
