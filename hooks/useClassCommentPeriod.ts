"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * 所感管理画面(クラス単位一覧)の対象期間(開始日・終了日)をクラスごとに記憶する。
 * CLAUDE.mdの楽観的更新禁止方針に従い、入力欄の表示値は常にmutation成功後にのみ更新され、
 * mutation失敗時も何もしないだけで直前の確認済み値の表示が維持される
 * (表示値を先に書き換えていないため)。
 */
export function useClassCommentPeriod(classId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const periodQuery = useQuery({
    queryKey: ["class-comment-period", classId],
    queryFn: async (): Promise<{ periodStartDate: string | null; periodEndDate: string | null }> => {
      const { data, error } = await supabase
        .from("class")
        .select("comment_period_start_date, comment_period_end_date")
        .eq("id", classId)
        .single();
      if (error) throw error;
      return {
        periodStartDate: data.comment_period_start_date,
        periodEndDate: data.comment_period_end_date,
      };
    },
    enabled: classId !== null,
  });

  /** 開始日・終了日をまとめて1回のupdateで送る(片方ずつ送ると後勝ち上書きの恐れがあるため) */
  const updatePeriod = useMutation({
    mutationFn: async (input: { periodStartDate: string; periodEndDate: string }) => {
      if (!classId) return;
      const { error } = await supabase
        .from("class")
        .update({
          comment_period_start_date: input.periodStartDate || null,
          comment_period_end_date: input.periodEndDate || null,
        })
        .eq("id", classId);
      if (error) throw error;
    },
    // invalidateQueries + 再取得ではなく、保存に成功した値をそのままキャッシュへ書き込む。
    // invalidateQueriesは既定では非アクティブなクエリ(他のクラスに切り替えた後など)を
    // 再取得しないため、そのクラスに戻ったときに古いキャッシュ値が残ってしまう恐れがある。
    // 保存に成功した値は送信した内容そのものであり、サーバーから改めて読み直さなくても
    // 内容は確定しているため、mutation成功後にキャッシュへ直接反映してよい
    onSuccess: (_data, variables) =>
      queryClient.setQueryData(["class-comment-period", classId], {
        periodStartDate: variables.periodStartDate || null,
        periodEndDate: variables.periodEndDate || null,
      }),
  });

  return {
    periodStartDate: periodQuery.data?.periodStartDate ?? "",
    periodEndDate: periodQuery.data?.periodEndDate ?? "",
    updatePeriod,
    isLoading: periodQuery.isLoading,
  };
}
