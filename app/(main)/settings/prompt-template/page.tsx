"use client";

import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PromptTemplateForm } from "./PromptTemplateForm";

export default function PromptTemplatePage() {
  const { template, isLoading, saveTemplate } = usePromptTemplate();

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return <PromptTemplateForm initialTemplate={template} saveTemplate={saveTemplate} />;
}
