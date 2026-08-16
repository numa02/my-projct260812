"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type CommentCreationMethod = "direct_ai" | "prompt_copy" | "manual";

export interface StudentCommentRow {
  id: string;
  periodStartDate: string;
  periodEndDate: string;
  content: string;
  targetCharCount: number | null;
  creationMethod: CommentCreationMethod;
  updatedAt: string;
}

/** F11向け。生徒ごとの所感(期間別)の一覧取得・保存(新規/上書き)を行う */
export function useStudentComments(studentId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ["student-comments", studentId],
    queryFn: async (): Promise<StudentCommentRow[]> => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_comment")
        .select("id, period_start_date, period_end_date, content, target_char_count, creation_method, updated_at")
        .eq("student_id", studentId)
        .order("period_start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        periodStartDate: c.period_start_date,
        periodEndDate: c.period_end_date,
        content: c.content,
        targetCharCount: c.target_char_count,
        creationMethod: c.creation_method,
        updatedAt: c.updated_at,
      }));
    },
    enabled: studentId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["student-comments", studentId] });

  /** 生徒・期間の組み合わせにつき1件、upsertで新規保存/上書きする(F11) */
  const saveComment = useMutation({
    mutationFn: async (input: {
      periodStartDate: string;
      periodEndDate: string;
      content: string;
      targetCharCount?: number;
      creationMethod: CommentCreationMethod;
    }) => {
      const { error } = await supabase.from("student_comment").upsert(
        {
          student_id: studentId,
          period_start_date: input.periodStartDate,
          period_end_date: input.periodEndDate,
          content: input.content,
          target_char_count: input.targetCharCount ?? null,
          creation_method: input.creationMethod,
        },
        { onConflict: "student_id,period_start_date,period_end_date" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    comments: commentsQuery.data ?? [],
    isLoading: commentsQuery.isLoading,
    saveComment,
  };
}
