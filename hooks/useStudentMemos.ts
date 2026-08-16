"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface StudentMemoRow {
  id: string;
  subjectId: string;
  subjectName: string;
  noteDate: string;
  period: number;
  content: string;
  shareFlag: "shared" | "private";
}

/** 生徒別メモ一覧画面(F7)向け。特定生徒の全メモ(共有区分を問わず)を取得し、編集・削除・共有区分変更を行う */
export function useStudentMemos(studentId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const memosQuery = useQuery({
    queryKey: ["student-memos", studentId],
    queryFn: async (): Promise<StudentMemoRow[]> => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("memo")
        .select("id, subject_id, note_date, period, content, share_flag, subject(name)")
        .eq("student_id", studentId)
        .order("note_date", { ascending: false })
        .order("period", { ascending: false });
      if (error) throw error;
      // supabase-jsの型推論は多対一の埋め込みも配列型と推論するが、実際のPostgRESTレスポンスは単一オブジェクト
      const rows = data as unknown as Array<{
        id: string;
        subject_id: string;
        note_date: string;
        period: number;
        content: string;
        share_flag: "shared" | "private";
        subject: { name: string } | null;
      }>;
      return rows.map((m) => ({
        id: m.id,
        subjectId: m.subject_id,
        subjectName: m.subject?.name ?? "",
        noteDate: m.note_date,
        period: m.period,
        content: m.content,
        shareFlag: m.share_flag,
      }));
    },
    enabled: studentId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["student-memos", studentId] });

  const updateMemo = useMutation({
    mutationFn: async (input: { id: string; content?: string; shareFlag?: "shared" | "private" }) => {
      const patch: Record<string, string> = {};
      if (input.content !== undefined) patch.content = input.content;
      if (input.shareFlag !== undefined) patch.share_flag = input.shareFlag;
      const { error } = await supabase.from("memo").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMemo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    memos: memosQuery.data ?? [],
    isLoading: memosQuery.isLoading,
    updateMemo,
    deleteMemo,
  };
}
