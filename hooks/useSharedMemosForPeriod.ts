"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { PromptMemo } from "@/shared/prompt-builder";

/** F9/F10向け。指定期間内のその生徒の「共有する」区分のメモのみを取得する(所感生成の対象) */
export function useSharedMemosForPeriod(studentId: string | null, startDate: string, endDate: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const memosQuery = useQuery({
    queryKey: ["shared-memos-for-period", studentId, startDate, endDate],
    queryFn: async (): Promise<PromptMemo[]> => {
      if (!studentId || !startDate || !endDate) return [];
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
