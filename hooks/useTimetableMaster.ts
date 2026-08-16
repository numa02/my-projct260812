"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTeacherProfile } from "./useTeacherProfile";

export interface MasterSlotState {
  weekday: number;
  period: number;
  subjectId: string | null;
  classId: string | null;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6];

function emptySlots(): MasterSlotState[] {
  const slots: MasterSlotState[] = [];
  for (const weekday of WEEKDAYS) {
    for (const period of PERIODS) {
      slots.push({ weekday, period, subjectId: null, classId: null });
    }
  }
  return slots;
}

export function useTimetableMaster() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const slotsQuery = useQuery({
    queryKey: ["timetable-master-slots"],
    queryFn: async (): Promise<MasterSlotState[]> => {
      const { data, error } = await supabase
        .from("timetable_master_slot")
        .select("weekday, period, subject_id, class_id");
      if (error) throw error;

      const base = emptySlots();
      for (const row of data ?? []) {
        const target = base.find((s) => s.weekday === row.weekday && s.period === row.period);
        if (target) {
          target.subjectId = row.subject_id;
          target.classId = row.class_id;
        }
      }
      return base;
    },
  });

  const { startDate, isLoading: isProfileLoading } = useTeacherProfile();

  const hasMemoQuery = useQuery({
    queryKey: ["has-any-memo"],
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from("memo")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const saveMaster = useMutation({
    mutationFn: async (input: { slots: MasterSlotState[]; confirmOverwrite: boolean }) => {
      const { error } = await supabase.rpc("save_timetable_master", {
        p_slots: input.slots,
        p_confirm_overwrite: input.confirmOverwrite,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timetable-master-slots"] }),
  });

  const updateStartDate = useMutation({
    mutationFn: async (input: { newStartDate: string; force: boolean }) => {
      const { error } = await supabase.rpc("update_timetable_start_date", {
        p_new_start_date: input.newStartDate,
        p_force: input.force,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-profile"] }),
  });

  return {
    slots: slotsQuery.data ?? emptySlots(),
    isLoading: slotsQuery.isLoading || isProfileLoading || hasMemoQuery.isLoading,
    startDate,
    hasAnyMemo: hasMemoQuery.data ?? false,
    saveMaster,
    updateStartDate,
  };
}
