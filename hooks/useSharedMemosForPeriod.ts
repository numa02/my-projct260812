"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { PromptMemo } from "@/shared/prompt-builder";
import type { CommentKind } from "@/shared/schemas";

/** 総合の所見の材料を絞り込む科目名。完全一致で判定する(docs/features/general-shoken/design.md §7) */
export const GENERAL_SUBJECT_NAME = "総合";

/**
 * F9/F10向け。指定期間内のその生徒の「共有する」区分のメモのみを取得する(所見生成の対象)。
 * 学習の所見は科目「総合」以外の授業メモ(memo)、生活の所見は生活メモ(life_memo)、
 * 総合の所見は科目名が「総合」の授業メモのみを材料にする。
 * 学習と総合で材料が重複しないようにするため、学習側からは科目「総合」を除外する
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

      // 学習と総合はどちらも科目名で絞り込む(総合は「総合」のみ、学習は「総合」以外)。
      // 埋め込みリソースへのフィルタを効かせるため!innerで内部結合にする
      // (既定の左結合だと条件に合わない行が subject: null として残ってしまう)。
      // memo.subject_idはnot nullなので、内部結合にしても取り漏らしは起きない
      const query = supabase
        .from("memo")
        .select("note_date, period, content, subject!inner(name)");
      if (kind === "general") {
        query.eq("subject.name", GENERAL_SUBJECT_NAME);
      } else {
        query.neq("subject.name", GENERAL_SUBJECT_NAME);
      }

      const { data, error } = await query
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
