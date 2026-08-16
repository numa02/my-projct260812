"use client";

import { useMutation } from "@tanstack/react-query";

interface ApiErrorBody {
  error: { code: string; message: string };
}

/** F9向け。Hono経由で外部AIプロバイダを呼び出し、所感文の生のテキストを取得する(この時点では保存しない) */
export function useGenerateComment() {
  return useMutation({
    mutationFn: async (input: { prompt: string; targetCharCount?: number }) => {
      const res = await fetch("/api/comments/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        const err = body as ApiErrorBody;
        throw new Error(err.error?.message ?? "生成に失敗しました");
      }
      return body as { rawText: string };
    },
  });
}
