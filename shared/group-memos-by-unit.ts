import type { PromptMemo } from "./prompt-builder";

/** 単元が記録されていないメモのグループ名。UI・プロンプトの両方で使う */
export const UNIT_UNSET_LABEL = "単元未設定";

export interface UnitMemoGroup {
  /** 単元名。単元未設定のグループでは`UNIT_UNSET_LABEL` */
  unitName: string;
  /** 単元未設定をまとめたグループかどうか(`{{unitName}}`に渡すかの判断に使う) */
  isUnset: boolean;
  memos: PromptMemo[];
}

/**
 * 所見の「単元ごとに生成」用。材料メモを単元ごとに分ける。
 * 単元の並びは最初に現れた順(呼び出し側で日付順に並べて渡すため、実質的に学習した順になる)。
 * 単元未設定のメモは常に最後のグループにまとめる(該当が0件ならそのグループは作らない)
 */
export function groupMemosByUnit(memos: PromptMemo[]): UnitMemoGroup[] {
  const groups: UnitMemoGroup[] = [];
  const unsetMemos: PromptMemo[] = [];

  for (const memo of memos) {
    const unitName = memo.unitName?.trim();
    if (!unitName) {
      unsetMemos.push(memo);
      continue;
    }
    const group = groups.find((g) => g.unitName === unitName);
    if (group) {
      group.memos.push(memo);
    } else {
      groups.push({ unitName, isUnset: false, memos: [memo] });
    }
  }

  if (unsetMemos.length > 0) {
    groups.push({ unitName: UNIT_UNSET_LABEL, isUnset: true, memos: unsetMemos });
  }

  return groups;
}
