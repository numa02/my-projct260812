"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  DEFAULT_GENERAL_PROMPT_TEMPLATE,
  DEFAULT_GENERAL_UNIT_PROMPT_TEMPLATE,
  DEFAULT_LIFE_PROMPT_TEMPLATE,
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_UNIT_PROMPT_TEMPLATE,
} from "@/shared/prompt-builder";
import type { PromptTemplateKey } from "@/shared/schemas";

type Templates = Record<PromptTemplateKey, string>;

const DEFAULTS: Templates = {
  learning: DEFAULT_PROMPT_TEMPLATE,
  learning_unit: DEFAULT_UNIT_PROMPT_TEMPLATE,
  life: DEFAULT_LIFE_PROMPT_TEMPLATE,
  general: DEFAULT_GENERAL_PROMPT_TEMPLATE,
  general_unit: DEFAULT_GENERAL_UNIT_PROMPT_TEMPLATE,
};

/** ひな形ごとの保存先の列。送らなかった列はupsertで上書きされないため、他のひな形は保持される */
const TEMPLATE_COLUMN: Record<PromptTemplateKey, string> = {
  learning: "content",
  learning_unit: "unit_content",
  life: "life_content",
  general: "general_content",
  general_unit: "general_unit_content",
};

interface PromptTemplateRow {
  content: string | null;
  unit_content: string | null;
  life_content: string | null;
  general_content: string | null;
  general_unit_content: string | null;
}

/**
 * F10向け。教員が保存したプロンプトひな形を読み取り・更新する。
 * ひな形は所見の種類(学習・生活・総合)と生成単位(まとめて生成・単元ごと)の
 * 組み合わせで5つあり、未保存(null)のものは本ツール既定の初期値を使う
 */
export function usePromptTemplate() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: ["prompt-template"],
    queryFn: async (): Promise<Templates> => {
      const { data, error } = await supabase
        .from("prompt_template")
        .select("content, unit_content, life_content, general_content, general_unit_content")
        .maybeSingle<PromptTemplateRow>();
      if (error) throw error;
      return {
        learning: data?.content ?? DEFAULTS.learning,
        learning_unit: data?.unit_content ?? DEFAULTS.learning_unit,
        life: data?.life_content ?? DEFAULTS.life,
        general: data?.general_content ?? DEFAULTS.general,
        general_unit: data?.general_unit_content ?? DEFAULTS.general_unit,
      };
    },
  });

  /** 保存するひな形の列だけを送る(PostgRESTのupsertは送らなかった列を上書きしないため、他は保持される) */
  const saveTemplate = useMutation({
    mutationFn: async (input: { key: PromptTemplateKey; content: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const column = TEMPLATE_COLUMN[input.key];
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
