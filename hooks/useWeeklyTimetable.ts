"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  resolveWeeklySlots,
  type ClassOverride,
  type MasterSlot,
  type SubjectOverride,
} from "@/shared/resolve-weekly-slots";

export function useWeeklyTimetable(weekStartDateISO: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const masterQuery = useQuery({
    queryKey: ["timetable-master-slots-raw"],
    // マスタはほぼ変化しないため、週の切り替えごとに再取得しないよう長めにキャッシュする
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MasterSlot[]> => {
      const { data, error } = await supabase
        .from("timetable_master_slot")
        .select("weekday, period, subject_id, class_id");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        weekday: r.weekday,
        period: r.period,
        subjectId: r.subject_id,
        classId: r.class_id,
      }));
    },
  });

  const subjectOverridesQuery = useQuery({
    queryKey: ["weekly-subject-overrides", weekStartDateISO],
    queryFn: async (): Promise<SubjectOverride[]> => {
      const { data, error } = await supabase
        .from("weekly_subject_override")
        .select("weekday, period, subject_id")
        .eq("week_start_date", weekStartDateISO);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        weekday: r.weekday,
        period: r.period,
        subjectId: r.subject_id,
      }));
    },
  });

  const classOverridesQuery = useQuery({
    queryKey: ["weekly-class-overrides", weekStartDateISO],
    queryFn: async (): Promise<ClassOverride[]> => {
      const { data, error } = await supabase
        .from("weekly_class_override")
        .select("weekday, period, class_id")
        .eq("week_start_date", weekStartDateISO);
      if (error) throw error;
      return (data ?? []).map((r) => ({ weekday: r.weekday, period: r.period, classId: r.class_id }));
    },
  });

  const resolvedSlots = useMemo(
    () =>
      resolveWeeklySlots(
        masterQuery.data ?? [],
        subjectOverridesQuery.data ?? [],
        classOverridesQuery.data ?? [],
      ),
    [masterQuery.data, subjectOverridesQuery.data, classOverridesQuery.data],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["weekly-subject-overrides", weekStartDateISO] });
    queryClient.invalidateQueries({ queryKey: ["weekly-class-overrides", weekStartDateISO] });
  };

  /** 個別変更の保存。subjectId/classIdがnullの項目は個別変更しない(マスタ追従のまま) */
  const saveOverride = useMutation({
    mutationFn: async (input: {
      weekday: number;
      period: number;
      subjectId?: string | null;
      subjectChanged: boolean;
      classId?: string | null;
      classChanged: boolean;
    }) => {
      const teacherId = (await supabase.auth.getUser()).data.user!.id;

      if (input.subjectChanged) {
        await supabase
          .from("weekly_subject_override")
          .upsert(
            {
              teacher_id: teacherId,
              week_start_date: weekStartDateISO,
              weekday: input.weekday,
              period: input.period,
              subject_id: input.subjectId ?? null,
            },
            { onConflict: "teacher_id,week_start_date,weekday,period" },
          )
          .then(({ error }) => {
            if (error) throw error;
          });
      }

      if (input.classChanged && input.classId) {
        const { error } = await supabase
          .from("weekly_class_override")
          .upsert(
            {
              teacher_id: teacherId,
              week_start_date: weekStartDateISO,
              weekday: input.weekday,
              period: input.period,
              class_id: input.classId,
            },
            { onConflict: "teacher_id,week_start_date,weekday,period" },
          );
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  /** 「マスタの内容に戻す」: その週・そのマスの個別変更(科目・クラス両方)を削除する */
  const revertToMaster = useMutation({
    mutationFn: async (input: { weekday: number; period: number }) => {
      const [subjectRes, classRes] = await Promise.all([
        supabase
          .from("weekly_subject_override")
          .delete()
          .eq("week_start_date", weekStartDateISO)
          .eq("weekday", input.weekday)
          .eq("period", input.period),
        supabase
          .from("weekly_class_override")
          .delete()
          .eq("week_start_date", weekStartDateISO)
          .eq("weekday", input.weekday)
          .eq("period", input.period),
      ]);
      if (subjectRes.error) throw subjectRes.error;
      if (classRes.error) throw classRes.error;
    },
    onSuccess: invalidate,
  });

  return {
    resolvedSlots,
    isLoading:
      masterQuery.isLoading || subjectOverridesQuery.isLoading || classOverridesQuery.isLoading,
    saveOverride,
    revertToMaster,
  };
}
