"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { ParsedStudentRow } from "@/shared/parse-student-rows";
import type { ImportErrorRow } from "@/components/ui/PasteOrUploadArea";

export interface StudentRow {
  id: string;
  attendanceNumber: number;
  name: string;
}

export function useStudents(classId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: ["students", classId],
    queryFn: async (): Promise<StudentRow[]> => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("student")
        .select("id, attendance_number, name")
        .eq("class_id", classId)
        .order("attendance_number");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        attendanceNumber: s.attendance_number,
        name: s.name,
      }));
    },
    enabled: classId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["students", classId] });

  const importStudents = useMutation({
    mutationFn: async (rows: ParsedStudentRow[]) => {
      const { data, error } = await supabase
        .rpc("import_students", { p_class_id: classId, p_rows: rows })
        .single();
      if (error) throw error;
      return data as { imported: unknown[]; errors: ImportErrorRow[] };
    },
    onSuccess: invalidate,
  });

  const updateStudent = useMutation({
    mutationFn: async (input: { id: string; attendanceNumber: number; name: string }) => {
      const { error } = await supabase
        .from("student")
        .update({ attendance_number: input.attendanceNumber, name: input.name })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    students: studentsQuery.data ?? [],
    isLoading: studentsQuery.isLoading,
    importStudents,
    updateStudent,
    deleteStudent,
  };
}
