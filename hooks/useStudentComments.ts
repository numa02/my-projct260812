"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CommentKind } from "@/shared/schemas";

export type CommentCreationMethod = "direct_ai" | "prompt_copy" | "manual";

export interface StudentComment {
  id: string;
  content: string;
  targetCharCount: number | null;
  creationMethod: CommentCreationMethod;
  updatedAt: string;
}

/** 3種類の所見は、一意制約(student_id)を保つためそれぞれ別テーブルで保持している */
const COMMENT_TABLE: Record<
  CommentKind,
  "student_comment" | "student_life_comment" | "student_general_comment"
> = {
  learning: "student_comment",
  life: "student_life_comment",
  general: "student_general_comment",
};

/** F11向け。生徒ごと・種類ごとに常に最新1件のみを保持する所見の取得・保存(新規/上書き)を行う */
export function useStudentComments(studentId: string | null, kind: CommentKind = "learning") {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();
  const table = COMMENT_TABLE[kind];

  const commentQuery = useQuery({
    queryKey: ["student-comments", kind, studentId],
    queryFn: async (): Promise<StudentComment | null> => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from(table)
        .select("id, content, target_char_count, creation_method, updated_at")
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        content: data.content,
        targetCharCount: data.target_char_count,
        creationMethod: data.creation_method,
        updatedAt: data.updated_at,
      };
    },
    enabled: studentId !== null,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["student-comments", kind, studentId] });

  /** 生徒につき1件、upsertで新規保存/上書きする(F11) */
  const saveComment = useMutation({
    mutationFn: async (input: {
      content: string;
      targetCharCount?: number;
      creationMethod: CommentCreationMethod;
    }) => {
      const { error } = await supabase.from(table).upsert(
        {
          student_id: studentId,
          content: input.content,
          target_char_count: input.targetCharCount ?? null,
          creation_method: input.creationMethod,
        },
        { onConflict: "student_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    comment: commentQuery.data ?? null,
    isLoading: commentQuery.isLoading,
    saveComment,
  };
}
