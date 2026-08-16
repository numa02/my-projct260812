"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { DEFAULT_PROMPT_TEMPLATE } from "@/shared/prompt-builder";

/** F10向け。教員が保存したひな形を読み取る。未保存の場合は本ツール既定の初期値を使う */
export function usePromptTemplate() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const templateQuery = useQuery({
    queryKey: ["prompt-template"],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.from("prompt_template").select("content").maybeSingle();
      if (error) throw error;
      return data?.content ?? DEFAULT_PROMPT_TEMPLATE;
    },
  });

  return {
    template: templateQuery.data ?? DEFAULT_PROMPT_TEMPLATE,
    isLoading: templateQuery.isLoading,
  };
}
