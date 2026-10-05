"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface UnitRow {
  id: string;
  name: string;
}

/**
 * 単元マスタ(科目管理画面内)向け。科目ごとの単元を登録順に取得・追加・編集・削除する。
 * `unit`は`subject_id`しか持たないため、`teacher_id`をクライアントから渡す必要がない
 * (所有者はRLSが`subject`経由で判定する)
 */
export function useUnits(subjectId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const unitsQuery = useQuery({
    queryKey: ["units", subjectId],
    queryFn: async (): Promise<UnitRow[]> => {
      if (!subjectId) return [];
      const { data, error } = await supabase
        .from("unit")
        .select("id, name")
        .eq("subject_id", subjectId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: subjectId !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["units", subjectId] });

  const createUnit = useMutation({
    mutationFn: async (name: string) => {
      if (!subjectId) throw new Error("科目が未選択です");
      const { error } = await supabase.from("unit").insert({ subject_id: subjectId, name });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateUnit = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from("unit").update({ name: input.name }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** 単元を削除する。この単元を参照していたメモは`on delete set null (unit_id)`で単元未設定に戻る */
  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unit").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    units: unitsQuery.data ?? [],
    isLoading: unitsQuery.isLoading,
    createUnit,
    updateUnit,
    deleteUnit,
  };
}
