"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiProvider } from "@/shared/ai-models";

export interface AiProviderSettingData {
  provider: AiProvider | null;
  model: string | null;
  hasKey: boolean;
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const body = await res.json();
  if (!res.ok) {
    const err = body as ApiErrorBody;
    throw new Error(err.error?.message ?? "リクエストに失敗しました");
  }
  return body as T;
}

/** 設定画面(F9)向け。APIキー本体はサーバーから返らないため、保存フォームには常に空欄から入力する */
export function useAiProviderSettings() {
  const queryClient = useQueryClient();

  const settingQuery = useQuery({
    queryKey: ["ai-provider-setting"],
    queryFn: () => fetchJson<AiProviderSettingData>("/api/settings/ai-provider"),
  });

  const saveSetting = useMutation({
    mutationFn: (input: { provider: AiProvider; model: string; apiKey: string }) =>
      fetchJson<AiProviderSettingData>("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-provider-setting"] }),
  });

  return {
    setting: settingQuery.data ?? { provider: null, model: null, hasKey: false },
    isLoading: settingQuery.isLoading,
    saveSetting,
  };
}
