"use client";

import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PromptTemplateForm } from "./PromptTemplateForm";

export default function PromptTemplatePage() {
  const { templates, isLoading, saveTemplate } = usePromptTemplate();

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">プロンプトひな形編集</h1>
      <PromptTemplateForm kind="learning" initialTemplate={templates.learning} saveTemplate={saveTemplate} />
      <PromptTemplateForm kind="life" initialTemplate={templates.life} saveTemplate={saveTemplate} />
      <PromptTemplateForm
        kind="general"
        initialTemplate={templates.general}
        saveTemplate={saveTemplate}
      />
    </div>
  );
}
