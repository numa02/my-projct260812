"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { PromptMemo } from "@/shared/prompt-builder";
import type { CommentKind } from "@/shared/schemas";

/**
 * F9/F10向け。指定期間内のその生徒の「共有する」区分のメモのみを取得する(所見生成の対象)。
 * 学習の所見は授業メモ(memo)、生活の所見は生活メモ(life_memo)を材料にする
 */
export function useSharedMemosForPeriod(
  studentId: string | null,
  startDate: string,
  endDate: string,
  kind: CommentKind = "learning",
) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const memosQuery = useQuery({
    queryKey: ["shared-memos-for-period", kind, studentId, startDate, endDate],
    queryFn: async (): Promise<PromptMemo[]> => {
      if (!studentId || !startDate || !endDate) return [];

      if (kind === "life") {
        const { data, error } = await supabase
          .from("life_memo")
          .select("note_date, content")
          .eq("student_id", studentId)
          .eq("share_flag", "shared")
          .gte("note_date", startDate)
          .lte("note_date", endDate)
          .order("note_date");
        if (error) throw error;
        return (data ?? []).map((r) => ({ noteDate: r.note_date, content: r.content }));
      }

      const { data, error } = await supabase
        .from("memo")
        .select("note_date, period, content, subject(name)")
        .eq("student_id", studentId)
        .eq("share_flag", "shared")
        .gte("note_date", startDate)
        .lte("note_date", endDate)
        .order("note_date")
        .order("period");
      if (error) throw error;
      // supabase-jsの型推論は多対一の埋め込みも配列型と推論するが、実際のPostgRESTレスポンスは単一オブジェクト
      const rows = data as unknown as Array<{
        note_date: string;
        period: number;
        content: string;
        subject: { name: string } | null;
      }>;
      return rows.map((r) => ({
        subjectName: r.subject?.name ?? "",
        noteDate: r.note_date,
        period: r.period,
        content: r.content,
      }));
    },
    enabled: studentId !== null && startDate !== "" && endDate !== "",
  });

  return {
    memos: memosQuery.data ?? [],
    isLoading: memosQuery.isLoading,
  };
}
