"use client";

import { useState } from "react";
import Link from "next/link";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { useSharedMemosForPeriod } from "@/hooks/useSharedMemosForPeriod";
import { useStudentComments } from "@/hooks/useStudentComments";
import { useGenerateComment } from "@/hooks/useGenerateComment";
import { buildPrompt } from "@/shared/prompt-builder";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export interface CommentGenerateTabProps {
  studentId: string;
  pseudonymCode: string;
}

/** 所感画面「生成」タブ。直接呼び出し(F9)に対応。プロンプトコピー運用(F10)はAPIキー未設定時の案内のみ表示する */
export function CommentGenerateTab({ studentId, pseudonymCode }: CommentGenerateTabProps) {
  const { showToast } = useToast();
  const { setting, isLoading: isLoadingSetting } = useAiProviderSettings();
  const { template, isLoading: isLoadingTemplate } = usePromptTemplate();
  const { comments, saveComment } = useStudentComments(studentId);
  const generateComment = useGenerateComment();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetCharCount, setTargetCharCount] = useState("");
  const [resultText, setResultText] = useState("");
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);

  const { memos, isLoading: isLoadingMemos } = useSharedMemosForPeriod(studentId, startDate, endDate);
  const hasPeriod = startDate !== "" && endDate !== "";
  const hasSharedMemos = memos.length > 0;
  const targetCharCountNumber = targetCharCount.trim() ? Number(targetCharCount) : undefined;

  const handleGenerate = async () => {
    const prompt = buildPrompt({ template, memos, targetCharCount: targetCharCountNumber, pseudonymCode });
    try {
      const { rawText } = await generateComment.mutateAsync({
        prompt,
        targetCharCount: targetCharCountNumber,
      });
      setResultText(rawText);
    } catch (err) {
      showToast("error", (err as Error).message || "生成に失敗しました");
    }
  };

  const doSave = async () => {
    try {
      await saveComment.mutateAsync({
        periodStartDate: startDate,
        periodEndDate: endDate,
        content: resultText.trim(),
        targetCharCount: targetCharCountNumber,
        creationMethod: "direct_ai",
      });
      showToast("success", "所感を保存しました");
      setOverwriteConfirmOpen(false);
    } catch {
      showToast("error", "保存に失敗しました");
    }
  };

  const handleSaveClick = () => {
    if (resultText.trim().length === 0) return;
    const existing = comments.find(
      (c) => c.periodStartDate === startDate && c.periodEndDate === endDate,
    );
    if (existing) {
      setOverwriteConfirmOpen(true);
    } else {
      doSave();
    }
  };

  if (isLoadingSetting || isLoadingTemplate) {
    return <LoadingSpinner label="読み込み中..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        仮名コード
        <CodeBadge code={pseudonymCode} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Input label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="終了日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <div className="w-32">
          <Input
            label="目安文字数"
            type="number"
            value={targetCharCount}
            onChange={(e) => setTargetCharCount(e.target.value)}
          />
        </div>
      </div>

      {hasPeriod && isLoadingMemos && <LoadingSpinner label="読み込み中..." />}

      {hasPeriod && !isLoadingMemos && !hasSharedMemos && (
        <EmptyState message="送信可能なメモが存在しません" />
      )}

      {hasPeriod && !isLoadingMemos && hasSharedMemos && setting.hasKey && (
        <>
          <InlineMessage
            variant="info"
            message="「共有する」区分のメモが仮名化された状態で外部のAIサービスに送信されます"
          />
          <Button variant="primary" loading={generateComment.isPending} onClick={handleGenerate}>
            生成
          </Button>
        </>
      )}

      {hasPeriod && !isLoadingMemos && hasSharedMemos && !setting.hasKey && (
        <div className="flex flex-col gap-2">
          <InlineMessage
            variant="warning"
            message="APIキーが未設定のため直接生成はできません。設定画面でAPIキーを登録してください"
          />
          <Link href="/settings/ai-provider" className="self-start text-sm text-gray-700 underline">
            AIプロバイダ設定画面へ
          </Link>
        </div>
      )}

      {resultText && (
        <>
          <Textarea
            label="生成結果"
            value={resultText}
            onChange={(e) => setResultText(e.target.value)}
            rows={8}
          />
          <Button
            variant="primary"
            className="self-start"
            loading={saveComment.isPending}
            onClick={handleSaveClick}
          >
            保存
          </Button>
        </>
      )}

      <ConfirmDialog
        title="この期間の所感は既に保存されています。上書きしますか"
        body="続行すると、既存の所感が新しい内容で上書きされます。"
        open={overwriteConfirmOpen}
        loading={saveComment.isPending}
        onConfirm={doSave}
        onCancel={() => setOverwriteConfirmOpen(false)}
      />
    </div>
  );
}
