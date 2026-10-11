"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CommentKind, PromptTemplateKey } from "@/shared/schemas";
import { PromptTemplateForm } from "./PromptTemplateForm";

/**
 * 所見の種類ごとのまとまり。学習・総合は「まとめて生成」用と「単元ごと」用の2つ、
 * 生活は単元を持たないため1つ(`docs/features/memo-unit/design.md` §4.5)
 */
const SECTIONS: { kind: CommentKind; title: string; keys: PromptTemplateKey[] }[] = [
  { kind: "learning", title: "学習の所見", keys: ["learning", "learning_unit"] },
  { kind: "life", title: "生活の所見", keys: ["life"] },
  { kind: "general", title: "総合の所見", keys: ["general", "general_unit"] },
];

export default function PromptTemplatePage() {
  const { templates, isLoading, saveTemplate } = usePromptTemplate();
  // 長文のテキストエリアが5つ縦に並ぶのを避け、同時に開くのは1つにする(既定は学習の所見)
  const [expandedKind, setExpandedKind] = useState<CommentKind | null>("learning");

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">プロンプトひな形編集</h1>

      <div className="flex max-w-2xl flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
        {SECTIONS.map((section) => {
          const expanded = expandedKind === section.kind;
          return (
            <div key={section.kind} className="flex flex-col">
              <button
                type="button"
                onClick={() => setExpandedKind((prev) => (prev === section.kind ? null : section.kind))}
                aria-expanded={expanded}
                className="flex items-center gap-1.5 px-4 py-3 text-left text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
                )}
                {section.title}
              </button>
              {expanded && (
                <div className="flex flex-col gap-10 border-t border-gray-100 px-4 py-4">
                  {section.keys.map((key) => (
                    <PromptTemplateForm
                      key={key}
                      templateKey={key}
                      initialTemplate={templates[key]}
                      saveTemplate={saveTemplate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
