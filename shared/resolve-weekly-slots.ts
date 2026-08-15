export interface MasterSlot {
  weekday: number;
  period: number;
  subjectId: string | null;
  classId: string | null;
}

export interface SubjectOverride {
  weekday: number;
  period: number;
  subjectId: string | null;
}

export interface ClassOverride {
  weekday: number;
  period: number;
  classId: string;
}

export interface ResolvedSlot {
  weekday: number;
  period: number;
  subjectId: string | null;
  classId: string | null;
  isSubjectOverridden: boolean;
  isClassOverridden: boolean;
}

/**
 * 時間割マスタ+その週の個別変更(科目・クラスは独立)をクライアント側でマージする。
 * 個別変更が存在するマスはその内容を、存在しないマスはマスタの内容を採用する。
 */
export function resolveWeeklySlots(
  master: MasterSlot[],
  subjectOverrides: SubjectOverride[],
  classOverrides: ClassOverride[],
): ResolvedSlot[] {
  return master.map((slot) => {
    const subjectOverride = subjectOverrides.find(
      (o) => o.weekday === slot.weekday && o.period === slot.period,
    );
    const classOverride = classOverrides.find(
      (o) => o.weekday === slot.weekday && o.period === slot.period,
    );

    return {
      weekday: slot.weekday,
      period: slot.period,
      subjectId: subjectOverride ? subjectOverride.subjectId : slot.subjectId,
      classId: classOverride ? classOverride.classId : slot.classId,
      isSubjectOverridden: subjectOverride !== undefined,
      isClassOverridden: classOverride !== undefined,
    };
  });
}
