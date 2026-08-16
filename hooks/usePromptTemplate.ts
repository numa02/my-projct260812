"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { DEFAULT_PROMPT_TEMPLATE } from "@/shared/prompt-builder";

/** F10向け。教員が保存したひな形を読み取り・更新する。未保存の場合は本ツール既定の初期値を使う */
export function usePromptTemplate() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: ["prompt-template"],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.from("prompt_template").select("content").maybeSingle();
      if (error) throw error;
      return data?.content ?? DEFAULT_PROMPT_TEMPLATE;
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (content: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("prompt_template")
        .upsert({ teacher_id: userData.user!.id, content }, { onConflict: "teacher_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-template"] }),
  });

  return {
    template: templateQuery.data ?? DEFAULT_PROMPT_TEMPLATE,
    isLoading: templateQuery.isLoading,
    saveTemplate,
  };
}
