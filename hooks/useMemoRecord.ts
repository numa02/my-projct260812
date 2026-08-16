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
        .select("student_id, content, share_flag")
        .eq("subject_id", subjectId)
        .eq("note_date", dateISO)
        .eq("period", period)
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        studentId: m.student_id,
        content: m.content,
        shareFlag: m.share_flag,
      }));
    },
    enabled: subjectId !== null && classId !== null && !isLoadingStudents,
  });

  const saveMemo = useMutation({
    mutationFn: async (input: {
      studentId: string;
      content: string;
      shareFlag: "shared" | "private";
    }) => {
      if (!subjectId) throw new Error("科目が未設定です");
      const { error } = await supabase.from("memo").upsert(
        {
          student_id: input.studentId,
          subject_id: subjectId,
          note_date: dateISO,
          period,
          content: input.content,
          share_flag: input.shareFlag,
        },
        { onConflict: "student_id,subject_id,note_date,period" },
      );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["record-memos", dateISO, period, subjectId, classId],
      }),
  });

  const classInfo = classes.find((c) => c.id === classId) ?? null;
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;

  return {
    isLoading:
      isLoadingTimetable || isLoadingClasses || isLoadingSubjects || (classId !== null && isLoadingStudents),
    isLoadingMemos: memosQuery.isLoading,
    subjectId,
    subjectName,
    classInfo,
    students,
    existingMemos: memosQuery.data ?? [],
    saveMemo,
  };
}
