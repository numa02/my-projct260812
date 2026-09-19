"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type MemoKind = "lesson" | "life";

export interface StudentMemoRow {
  id: string;
  /** lesson=授業メモ(memo)、life=生活メモ(life_memo) */
  kind: MemoKind;
  /** 生活メモでは「生活」 */
  subjectName: string;
  noteDate: string;
  /** 生活メモではnull */
  period: number | null;
  content: string;
  shareFlag: "shared" | "private";
}

export const LIFE_MEMO_LABEL = "生活";

const TABLE: Record<MemoKind, "memo" | "life_memo"> = { lesson: "memo", life: "life_memo" };

/** 日付の新しい順。同じ日付では授業メモ(時限の遅い順)を先に、生活メモを後に並べる */
function compareMemos(a: StudentMemoRow, b: StudentMemoRow): number {
  if (a.noteDate !== b.noteDate) return a.noteDate < b.noteDate ? 1 : -1;
  return (b.period ?? 0) - (a.period ?? 0);
}

/**
 * 生徒別メモ一覧画面(F7)向け。特定生徒の全メモ(授業メモ・生活メモ、共有区分を問わず)を取得し、
 * 編集・削除・共有区分変更、生活メモの追加を行う
 */
export function useStudentMemos(studentId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const memosQuery = useQuery({
    queryKey: ["student-memos", studentId],
    queryFn: async (): Promise<StudentMemoRow[]> => {
      if (!studentId) return [];
      const [lessonResult, lifeResult] = await Promise.all([
        supabase
          .from("memo")
          .select("id, note_date, period, content, share_flag, subject(name)")
          .eq("student_id", studentId),
        supabase
          .from("life_memo")
          .select("id, note_date, content, share_flag")
          .eq("student_id", studentId),
      ]);
      if (lessonResult.error) throw lessonResult.error;
      if (lifeResult.error) throw lifeResult.error;
      // supabase-jsの型推論は多対一の埋め込みも配列型と推論するが、実際のPostgRESTレスポンスは単一オブジェクト
      const lessonRows = lessonResult.data as unknown as Array<{
        id: string;
        note_date: string;
        period: number;
        content: string;
        share_flag: "shared" | "private";
        subject: { name: string } | null;
      }>;
      const rows: StudentMemoRow[] = [
        ...lessonRows.map((m) => ({
          id: m.id,
          kind: "lesson" as const,
          subjectName: m.subject?.name ?? "",
          noteDate: m.note_date,
          period: m.period,
          content: m.content,
          shareFlag: m.share_flag,
        })),
        ...(lifeResult.data ?? []).map((m) => ({
          id: m.id,
          kind: "life" as const,
          subjectName: LIFE_MEMO_LABEL,
          noteDate: m.note_date,
          period: null,
          content: m.content,
          shareFlag: m.share_flag,
        })),
      ];
      return rows.sort(compareMemos);
    },
    enabled: studentId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["student-memos", studentId] });

  const updateMemo = useMutation({
    mutationFn: async (input: {
      id: string;
      kind: MemoKind;
      content?: string;
      shareFlag?: "shared" | "private";
    }) => {
      const patch: Record<string, string> = {};
      if (input.content !== undefined) patch.content = input.content;
      if (input.shareFlag !== undefined) patch.share_flag = input.shareFlag;
      const { error } = await supabase.from(TABLE[input.kind]).update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMemo = useMutation({
    mutationFn: async (input: { id: string; kind: MemoKind }) => {
      const { error } = await supabase.from(TABLE[input.kind]).delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** 生活メモを1件追加する。同じ日付の生活メモが既にある場合は一意制約違反(23505)のエラーになる */
  const addLifeMemo = useMutation({
    mutationFn: async (input: { noteDate: string; content: string; shareFlag: "shared" | "private" }) => {
      const { error } = await supabase.from("life_memo").insert({
        student_id: studentId,
        note_date: input.noteDate,
        content: input.content,
        share_flag: input.shareFlag,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    memos: memosQuery.data ?? [],
    isLoading: memosQuery.isLoading,
    updateMemo,
    deleteMemo,
    addLifeMemo,
  };
}
