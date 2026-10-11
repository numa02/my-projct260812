"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useClasses } from "./useClasses";
import { useSubjects } from "./useSubjects";
import { useStudents } from "./useStudents";
import { useWeeklyTimetable } from "./useWeeklyTimetable";
import { formatISODate, getWeekdayNumber, getWeekStartDate } from "@/shared/week";

export interface ExistingMemo {
  studentId: string;
  content: string;
  shareFlag: "shared" | "private";
  /** そのメモに記録されている単元。単元未設定ならnull */
  unitId: string | null;
}

function parseJstDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00+09:00`);
}

/**
 * 授業記録画面(F6)向け。日付・時限から時間割を解決して科目・クラスを自動決定し、
 * そのクラスの生徒一覧+その日・時限のメモ既存分を取得する。
 */
export function useMemoRecord(dateISO: string, period: number) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const weekStartDateISO = useMemo(
    () => formatISODate(getWeekStartDate(parseJstDate(dateISO))),
    [dateISO],
  );
  const weekday = useMemo(() => getWeekdayNumber(parseJstDate(dateISO)), [dateISO]);

  const { resolvedSlots, isLoading: isLoadingTimetable } = useWeeklyTimetable(weekStartDateISO);
  const slot = resolvedSlots.find((s) => s.weekday === weekday && s.period === period) ?? null;
  const subjectId = slot?.subjectId ?? null;
  const classId = slot?.classId ?? null;

  const { classes, isLoading: isLoadingClasses } = useClasses();
  const { subjects, isLoading: isLoadingSubjects } = useSubjects();
  const { students, isLoading: isLoadingStudents } = useStudents(classId);

  const studentIds = students.map((s) => s.id);

  const memosQuery = useQuery({
    queryKey: ["record-memos", dateISO, period, subjectId, classId],
    queryFn: async (): Promise<ExistingMemo[]> => {
      if (!subjectId || studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("memo")
        .select("student_id, content, share_flag, unit_id")
        .eq("subject_id", subjectId)
        .eq("note_date", dateISO)
        .eq("period", period)
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        studentId: m.student_id,
        content: m.content,
        shareFlag: m.share_flag,
        unitId: m.unit_id,
      }));
    },
    enabled: subjectId !== null && classId !== null && !isLoadingStudents,
  });

  const invalidateMemos = () =>
    queryClient.invalidateQueries({
      queryKey: ["record-memos", dateISO, period, subjectId, classId],
    });

  const saveMemo = useMutation({
    mutationFn: async (input: {
      studentId: string;
      content: string;
      shareFlag: "shared" | "private";
      /** そのコマで選択中の単元。未選択ならnull */
      unitId: string | null;
    }) => {
      if (!subjectId) throw new Error("科目が未設定です");
      const { error } = await supabase.from("memo").upsert(
        {
          student_id: input.studentId,
          subject_id: subjectId,
          unit_id: input.unitId,
          note_date: dateISO,
          period,
          content: input.content,
          share_flag: input.shareFlag,
        },
        { onConflict: "student_id,subject_id,note_date,period" },
      );
      if (error) throw error;
    },
    onSuccess: invalidateMemos,
  });

  /**
   * そのコマの保存済みメモ全件の単元を付け替える。単元は「コマごとに1つ」であり、
   * プルダウンを変えたときに保存済みのメモだけ旧単元のまま残るのを避けるため、
   * 選択の変更時にまとめて更新する。単一テーブル・単一ステートメントのためRPCは使わない
   */
  const updateSlotUnit = useMutation({
    /** 更新できた既存メモの件数を返す(0件なら保存すべきものがなかったということ) */
    mutationFn: async (unitId: string | null): Promise<number> => {
      if (!subjectId) throw new Error("科目が未設定です");
      if (studentIds.length === 0) return 0;
      const { data, error } = await supabase
        .from("memo")
        .update({ unit_id: unitId })
        .eq("subject_id", subjectId)
        .eq("note_date", dateISO)
        .eq("period", period)
        .in("student_id", studentIds)
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: invalidateMemos,
  });

  const classInfo = classes.find((c) => c.id === classId) ?? null;
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;
  // そのコマに記録済みの単元(コマごとに1つのため、最初に見つかった非nullを採る)
  const slotUnitId = (memosQuery.data ?? []).find((m) => m.unitId !== null)?.unitId ?? null;

  return {
    isLoading:
      isLoadingTimetable || isLoadingClasses || isLoadingSubjects || (classId !== null && isLoadingStudents),
    isLoadingMemos: memosQuery.isLoading,
    subjectId,
    subjectName,
    classInfo,
    students,
    existingMemos: memosQuery.data ?? [],
    slotUnitId,
    /**
     * `slotUnitId`が「そのコマの実際の状態」として信頼できるかどうか。
     * メモのクエリは科目・クラス・生徒が揃うまで無効化されており、無効な間は
     * `isLoadingMemos`がfalseのまま`slotUnitId`がnullになる。これを読み込み完了と
     * 取り違えると、単元の初期選択が「選択しない」で確定してしまう
     */
    isSlotUnitResolved: memosQuery.isSuccess,
    saveMemo,
    updateSlotUnit,
  };
}
