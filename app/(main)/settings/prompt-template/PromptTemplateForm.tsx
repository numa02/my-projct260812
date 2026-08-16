"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface PromptTemplateFormProps {
  initialTemplate: string;
  saveTemplate: AsyncAction<string>;
}

/** 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される) */
export function PromptTemplateForm({ initialTemplate, saveTemplate }: PromptTemplateFormProps) {
  const { showToast } = useToast();
  const [content, setContent] = useState(initialTemplate);

  const handleSave = async () => {
    if (content.trim().length === 0) return;
    try {
      await saveTemplate.mutateAsync(content);
      showToast("success", "プロンプトひな形を保存しました");
    } catch {
      showToast("error", "保存に失敗しました");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">プロンプトひな形編集</h1>

      <div className="flex max-w-2xl flex-col gap-4">
        <InlineMessage
          variant="info"
          message="{{pseudonymCode}}(仮名コード)・{{targetCharCount}}(目安文字数)・{{memos}}(授業メモ)のプレースホルダーが、生成時に実際の値へ置き換えられます"
        />

        <Textarea
          label="プロンプトひな形"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
        />

        <Button
          variant="primary"
          size="lg"
          className="self-start"
          loading={saveTemplate.isPending}
          disabled={content.trim().length === 0}
          onClick={handleSave}
        >
          保存
        </Button>
      </div>
    </div>
  );
}
