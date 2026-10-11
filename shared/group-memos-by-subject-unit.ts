import { UNIT_UNSET_LABEL } from "./group-memos-by-unit";

/**
 * グループ化に必要な最小の形。`hooks/useStudentMemos`の`StudentMemoRow`がこれを満たす。
 * `shared/`から`hooks/`(クライアントコンポーネント)へ依存しないよう、構造だけを要求する
 */
export interface GroupableMemo {
  subjectName: string;
  /** 単元未設定の授業メモ・生活メモではnull */
  unitName: string | null;
}

export interface UnitGroup<T> {
  /** 単元名。単元未設定のグループでは`UNIT_UNSET_LABEL` */
  unitName: string;
  isUnset: boolean;
  memos: T[];
}

export interface SubjectGroup<T> {
  subjectName: string;
  /**
   * 単元の小グループ。その教科に単元付きのメモが1件もない場合はnullになり、
   * 呼び出し側は`memos`をそのまま並べる(従来の教科別表示と同じ見た目になる)
   */
  unitGroups: UnitGroup<T>[] | null;
  /** その教科のメモ全件(渡された順)。`unitGroups`がnullのときの表示に使う */
  memos: T[];
}

/**
 * 生徒別メモ一覧の「教科別」表示用。教科ごとにまとめた上で、
 * その教科に単元付きのメモが1件以上あるときだけ単元の小グループに分ける。
 * 単元未設定の小グループは単元付きの後に置く。
 * 教科・単元の並びはどちらも最初に現れた順(呼び出し側が日付の新しい順で渡す)
 */
export function groupMemosBySubjectAndUnit<T extends GroupableMemo>(memos: T[]): SubjectGroup<T>[] {
  const subjectGroups: SubjectGroup<T>[] = [];

  for (const memo of memos) {
    const group = subjectGroups.find((g) => g.subjectName === memo.subjectName);
    if (group) {
      group.memos.push(memo);
    } else {
      subjectGroups.push({ subjectName: memo.subjectName, unitGroups: null, memos: [memo] });
    }
  }

  for (const group of subjectGroups) {
    const hasUnit = group.memos.some((m) => m.unitName != null && m.unitName.trim() !== "");
    if (!hasUnit) continue;

    const unitGroups: UnitGroup<T>[] = [];
    const unsetMemos: T[] = [];
    for (const memo of group.memos) {
      const unitName = memo.unitName?.trim();
      if (!unitName) {
        unsetMemos.push(memo);
        continue;
      }
      const unitGroup = unitGroups.find((g) => g.unitName === unitName);
      if (unitGroup) {
        unitGroup.memos.push(memo);
      } else {
        unitGroups.push({ unitName, isUnset: false, memos: [memo] });
      }
    }
    if (unsetMemos.length > 0) {
      unitGroups.push({ unitName: UNIT_UNSET_LABEL, isUnset: true, memos: unsetMemos });
    }
    group.unitGroups = unitGroups;
  }

  return subjectGroups;
}
