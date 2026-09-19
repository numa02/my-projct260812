"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { DEFAULT_LIFE_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE } from "@/shared/prompt-builder";
import type { CommentKind } from "@/shared/schemas";

interface Templates {
  learning: string;
  life: string;
}

const DEFAULTS: Templates = { learning: DEFAULT_PROMPT_TEMPLATE, life: DEFAULT_LIFE_PROMPT_TEMPLATE };

/**
 * F10向け。教員が保存した学習の所見用・生活の所見用のひな形を読み取り・更新する。
 * 未保存(null)の場合は本ツール既定の初期値を使う
 */
export function usePromptTemplate() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: ["prompt-template"],
    queryFn: async (): Promise<Templates> => {
      const { data, error } = await supabase
        .from("prompt_template")
        .select("content, life_content")
        .maybeSingle();
      if (error) throw error;
      return {
        learning: data?.content ?? DEFAULT_PROMPT_TEMPLATE,
        life: data?.life_content ?? DEFAULT_LIFE_PROMPT_TEMPLATE,
      };
    },
  });

  /** 保存する種類の列だけを送る(PostgRESTのupsertは送らなかった列を上書きしないため、もう一方は保持される) */
  const saveTemplate = useMutation({
    mutationFn: async (input: { kind: CommentKind; content: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const column = input.kind === "life" ? "life_content" : "content";
      const { error } = await supabase
        .from("prompt_template")
        .upsert({ teacher_id: userData.user!.id, [column]: input.content }, { onConflict: "teacher_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-template"] }),
  });

  const templates = templateQuery.data ?? DEFAULTS;

  return {
    templates,
    isLoading: templateQuery.isLoading,
    saveTemplate,
  };
}
