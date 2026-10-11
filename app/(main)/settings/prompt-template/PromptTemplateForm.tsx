"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import type { PromptTemplateKey } from "@/shared/schemas";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

/**
 * ひな形ごとの表示名と、材料になるメモの呼び方。
 * 見出し・テキストエリアのラベル・保存ボタンの名前にはすべてこの`title`を使い、
 * 画面内で同じ文言が重複しないようにする(所見の種類と生成単位の両方を含める)
 */
const LABEL: Record<PromptTemplateKey, { title: string; memos: string }> = {
  learning: { title: "学習の所見用のひな形(まとめて生成)", memos: "授業メモ" },
  learning_unit: { title: "学習の所見用のひな形(単元ごと)", memos: "その単元の授業メモ" },
  life: { title: "生活の所見用のひな形", memos: "生活メモ" },
  general: { title: "総合の所見用のひな形(まとめて生成)", memos: "総合の授業メモ" },
  general_unit: { title: "総合の所見用のひな形(単元ごと)", memos: "その単元の総合の授業メモ" },
};

/** 「単元ごと」用のひな形でだけ、{{unitName}}が実際の単元名に置き換わる */
const UNIT_SCOPED_KEYS: PromptTemplateKey[] = ["learning_unit", "general_unit"];

export interface PromptTemplateFormProps {
  templateKey: PromptTemplateKey;
  initialTemplate: string;
  saveTemplate: AsyncAction<{ key: PromptTemplateKey; content: string }>;
}

/**
 * ひな形1つ分の編集フォーム。
 * 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される)
 */
export function PromptTemplateForm({
  templateKey,
  initialTemplate,
  saveTemplate,
}: PromptTemplateFormProps) {
  const { showToast } = useToast();
  const [content, setContent] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const label = LABEL[templateKey];
  const isUnitScoped = UNIT_SCOPED_KEYS.includes(templateKey);

  const handleSave = async () => {
    if (content.trim().length === 0) return;
    setSaving(true);
    try {
      await saveTemplate.mutateAsync({ key: templateKey, content });
      showToast("success", `${label.title}を保存しました`);
    } catch {
      showToast("error", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h3 className="text-base font-semibold text-gray-900">{label.title}</h3>

      <InlineMessage
        variant="info"
        message={
          isUnitScoped
            ? `{{pseudonymCode}}(仮名コード)・{{grade}}(学年)・{{targetCharCount}}(1単元あたりの目安文字数)・{{memos}}(${label.memos})・{{unitName}}(単元名)のプレースホルダーが、生成時に実際の値へ置き換えられます。このひな形は所見管理画面で「単元ごとに生成」を選んだときに使われます`
            : `{{pseudonymCode}}(仮名コード)・{{grade}}(学年)・{{targetCharCount}}(目安文字数)・{{memos}}(${label.memos})のプレースホルダーが、生成時に実際の値へ置き換えられます。{{unitName}}(単元名)も使えますが、まとめて生成では複数の単元が混ざるため「指定なし」になります`
        }
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
