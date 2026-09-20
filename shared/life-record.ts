export interface LifeRecordSlot {
  weekday: number;
  classId: string | null;
}

export type LifeRecordClassResolution =
  /** その日の時間割に登場するクラスが1つだけ(担任クラス)。選択欄は出さずにこのクラスに確定する */
  | { kind: "fixed"; classId: string }
  /** 教科担任制(2つ以上)、またはその日に授業がない(0)。candidateIdsから教員が選ぶ */
  | { kind: "select"; candidateIds: string[] };

/**
 * 生活記録画面の対象クラスを、その日(weekday)の時間割(個別変更反映後)から決める。
 * 候補の並びは時間割に登場する順(時限の早い順)。0件の場合は登録済みの全クラスを候補にする。
 */
export function resolveLifeRecordClassCandidates(
  slots: LifeRecordSlot[],
  weekday: number,
  allClassIds: string[],
): LifeRecordClassResolution {
  const dayClassIds: string[] = [];
  for (const slot of slots) {
    if (slot.weekday !== weekday || slot.classId === null) continue;
    if (!dayClassIds.includes(slot.classId)) dayClassIds.push(slot.classId);
  }

  if (dayClassIds.length === 1) return { kind: "fixed", classId: dayClassIds[0] };
  return { kind: "select", candidateIds: dayClassIds.length > 1 ? dayClassIds : allClassIds };
}
