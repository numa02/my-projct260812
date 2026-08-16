"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface ClassRow {
  id: string;
  grade: string;
  groupNumber: number;
  displayName: string;
}

export function useClasses() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async (): Promise<ClassRow[]> => {
      const { data, error } = await supabase
        .from("class")
        .select("id, grade, group_number, display_name")
        .order("grade")
        .order("group_number");
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        grade: c.grade,
        groupNumber: c.group_number,
        displayName: c.display_name,
      }));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["classes"] });

  const createClass = useMutation({
    mutationFn: async (input: { grade: string; displayName: string }) => {
      const { data, error } = await supabase
        .rpc("create_class", { p_grade: input.grade, p_display_name: input.displayName })
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateClassDisplayName = useMutation({
    mutationFn: async (input: { classId: string; displayName: string }) => {
      const { error } = await supabase
        .from("class")
        .update({ display_name: input.displayName })
        .eq("id", input.classId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateClassGrade = useMutation({
    mutationFn: async (input: { classId: string; newGrade: string }) => {
      const { data, error } = await supabase
        .rpc("update_class_grade", { p_class_id: input.classId, p_new_grade: input.newGrade })
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteClass = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.rpc("delete_class", { p_class_id: classId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** 削除確認ダイアログの文言出し分けのため、生徒数・時間割使用有無を事前に調べる */
  const checkClassUsage = async (
    classId: string,
  ): Promise<{ studentCount: number; usedInTimetable: boolean }> => {
    const [{ count: studentCount }, { count: masterCount }, { count: overrideCount }] =
      await Promise.all([
        supabase.from("student").select("id", { count: "exact", head: true }).eq("class_id", classId),
        supabase
          .from("timetable_master_slot")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId),
        supabase
          .from("weekly_class_override")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId),
      ]);

    return {
      studentCount: studentCount ?? 0,
      usedInTimetable: (masterCount ?? 0) > 0 || (overrideCount ?? 0) > 0,
    };
  };

  return {
    classes: classesQuery.data ?? [],
    isLoading: classesQuery.isLoading,
    createClass,
    updateClassDisplayName,
    updateClassGrade,
    deleteClass,
    checkClassUsage,
  };
}
