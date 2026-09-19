"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import type { CommentKind } from "@/shared/schemas";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

const LABEL: Record<CommentKind, { title: string; memos: string }> = {
  learning: { title: "学習の所見用のひな形", memos: "授業メモ" },
  life: { title: "生活の所見用のひな形", memos: "生活メモ" },
};

export interface PromptTemplateFormProps {
  kind: CommentKind;
  initialTemplate: string;
  saveTemplate: AsyncAction<{ kind: CommentKind; content: string }>;
}

/**
 * 1種類分(学習の所見用 or 生活の所見用)のひな形編集フォーム。
 * 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される)
 */
export function PromptTemplateForm({ kind, initialTemplate, saveTemplate }: PromptTemplateFormProps) {
  const { showToast } = useToast();
  const [content, setContent] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const label = LABEL[kind];

  const handleSave = async () => {
    if (content.trim().length === 0) return;
    setSaving(true);
    try {
      await saveTemplate.mutateAsync({ kind, content });
      showToast("success", `${label.title}を保存しました`);
    } catch {
      showToast("error", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">{label.title}</h2>

      <InlineMessage
        variant="info"
        message={`{{pseudonymCode}}(仮名コード)・{{targetCharCount}}(目安文字数)・{{memos}}(${label.memos})のプレースホルダーが、生成時に実際の値へ置き換えられます`}
      />

      <Textarea label={label.title} value={content} onChange={(e) => setContent(e.target.value)} rows={10} />

      <Button
        variant="primary"
        size="lg"
        className="self-start"
        loading={saving}
        disabled={content.trim().length === 0}
        onClick={handleSave}
        aria-label={`${label.title}を保存`}
      >
        保存
      </Button>
    </section>
  );
}
