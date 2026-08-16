"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface ClassOption {
  id: string;
  grade: string;
  groupNumber: number;
  displayName: string;
}

export interface StudentOption {
  id: string;
  attendanceNumber: number;
  name: string;
}

/**
 * 生徒名簿(T-055)・生徒別メモ一覧(T-064)・所感画面(T-065)で共通利用する画面内クラス選択フック。
 * 教員のクラス一覧取得+選択中クラスの生徒一覧取得をまとめて提供する。
 */
export function useClassOptions(initialClassId: string | null = null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId);

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async (): Promise<ClassOption[]> => {
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

  const studentsQuery = useQuery({
    queryKey: ["students", selectedClassId],
    queryFn: async (): Promise<StudentOption[]> => {
      if (!selectedClassId) return [];
      const { data, error } = await supabase
        .from("student")
        .select("id, attendance_number, name")
        .eq("class_id", selectedClassId)
        .order("attendance_number");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        attendanceNumber: s.attendance_number,
        name: s.name,
      }));
    },
    enabled: selectedClassId !== null,
  });

  return {
    classes: classesQuery.data ?? [],
    isLoadingClasses: classesQuery.isLoading,
    selectedClassId,
    setSelectedClassId,
    students: studentsQuery.data ?? [],
    isLoadingStudents: studentsQuery.isLoading,
  };
}
