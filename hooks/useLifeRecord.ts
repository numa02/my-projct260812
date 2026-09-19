"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useClasses, type ClassRow } from "./useClasses";
import { useStudents } from "./useStudents";
import { useWeeklyTimetable } from "./useWeeklyTimetable";
import type { ExistingMemo } from "./useMemoRecord";
import { formatISODate, getWeekdayNumber, getWeekStartDate } from "@/shared/week";
import { resolveLifeRecordClassCandidates } from "@/shared/life-record";

function parseJstDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00+09:00`);
}

/**
 * 生活記録画面向け。日付の時間割(個別変更反映後)から対象クラスを決め、
 * そのクラスの生徒一覧+その日の生活メモ既存分を取得する。
 * その日のクラスが1つなら確定(選択欄なし)、それ以外は教員が選ぶ(selectedClassId)。
 */
export function useLifeRecord(dateISO: string, selectedClassId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const weekStartDateISO = useMemo(
    () => formatISODate(getWeekStartDate(parseJstDate(dateISO))),
    [dateISO],
  );
  const weekday = useMemo(() => getWeekdayNumber(parseJstDate(dateISO)), [dateISO]);

  const { resolvedSlots, isLoading: isLoadingTimetable } = useWeeklyTimetable(weekStartDateISO);
  const { classes, isLoading: isLoadingClasses } = useClasses();

  const resolution = resolveLifeRecordClassCandidates(
    resolvedSlots,
    weekday,
    classes.map((c) => c.id),
  );
  const candidateClasses: ClassRow[] =
    resolution.kind === "select"
      ? resolution.candidateIds
          .map((id) => classes.find((c) => c.id === id))
          .filter((c): c is ClassRow => c !== undefined)
      : [];
  // 選択式の場合、未選択または候補外(日付変更で候補が変わった等)なら候補の先頭を既定にする
  const classId =
    resolution.kind === "fixed"
      ? resolution.classId
      : candidateClasses.some((c) => c.id === selectedClassId)
        ? selectedClassId
        : (candidateClasses[0]?.id ?? null);

  const { students, isLoading: isLoadingStudents } = useStudents(classId);
  const studentIds = students.map((s) => s.id);

  const memosQuery = useQuery({
    queryKey: ["life-record-memos", dateISO, classId],
    queryFn: async (): Promise<ExistingMemo[]> => {
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("life_memo")
        .select("student_id, content, share_flag")
        .eq("note_date", dateISO)
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        studentId: m.student_id,
        content: m.content,
        shareFlag: m.share_flag,
      }));
    },
    enabled: classId !== null && !isLoadingStudents,
  });

  /** 1人1日1件。既にあれば上書きする */
  const saveMemo = useMutation({
    mutationFn: async (input: {
      studentId: string;
      content: string;
      shareFlag: "shared" | "private";
    }) => {
      const { error } = await supabase.from("life_memo").upsert(
        {
          student_id: input.studentId,
          note_date: dateISO,
          content: input.content,
          share_flag: input.shareFlag,
        },
        { onConflict: "student_id,note_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-record-memos", dateISO, classId] });
      queryClient.invalidateQueries({ queryKey: ["student-memos"] });
    },
  });

  return {
    isLoading: isLoadingTimetable || isLoadingClasses || (classId !== null && isLoadingStudents),
    isLoadingMemos: memosQuery.isLoading,
    /** 選択欄を出すかどうか。falseならその日のクラスに確定している */
    needsClassSelection: resolution.kind === "select",
    candidateClasses,
    classInfo: classes.find((c) => c.id === classId) ?? null,
    students,
    existingMemos: memosQuery.data ?? [],
    saveMemo,
  };
}
