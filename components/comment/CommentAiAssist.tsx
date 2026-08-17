"use client";

import { useMemo, useState } from "react";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { useSharedMemosForPeriod } from "@/hooks/useSharedMemosForPeriod";
import { useGenerateComment } from "@/hooks/useGenerateComment";
import type { CommentCreationMethod } from "@/hooks/useStudentComments";
import { buildPrompt } from "@/shared/prompt-builder";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";

export interface CommentAiAssistProps {
  studentId: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  /** 生成・貼り付けた内容を行の所感欄に反映する(この時点ではまだ保存しない) */
  onApply: (content: string, method: CommentCreationMethod) => void;
}

/**
 * 所感一覧画面の行内で折りたたまれるAI生成セクション(F9, F10)。
 * 直接呼び出し(APIキー設定済み)・プロンプトコピー運用のいずれも、結果は自前で保存せず
 * onApplyで行の所感欄(常時表示のテキストエリア)に反映するだけに留める。保存は行側の責務
 */
export function CommentAiAssist({
  studentId,
  pseudonymCode,
  periodStartDate,
  periodEndDate,
  onApply,
}: CommentAiAssistProps) {
  const { showToast } = useToast();
  const { setting, isLoading: isLoadingSetting } = useAiProviderSettings();
  const { template, isLoading: isLoadingTemplate } = usePromptTemplate();
  const generateComment = useGenerateComment();

  const [targetCharCount, setTargetCharCount] = useState("");
  const [pastedText, setPastedText] = useState("");

  const { memos, isLoading: isLoadingMemos } = useSharedMemosForPeriod(
    studentId,
    periodStartDate,
    periodEndDate,
  );
  const hasSharedMemos = memos.length > 0;
  const targetCharCountNumber = targetCharCount.trim() ? Number(targetCharCount) : undefined;

  const prompt = useMemo(
    () => buildPrompt({ template, memos, targetCharCount: targetCharCountNumber, pseudonymCode }),
    [template, memos, targetCharCountNumber, pseudonymCode],
  );

  const handleGenerate = async () => {
    try {
      const { rawText } = await generateComment.mutateAsync({
        prompt,
        targetCharCount: targetCharCountNumber,
      });
      onApply(rawText, "direct_ai");
      showToast("success", "生成結果を所感欄に反映しました");
    } catch (err) {
      showToast("error", (err as Error).message || "生成に失敗しました");
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast("success", "プロンプトをコピーしました");
    } catch {
      showToast("error", "コピーに失敗しました");
    }
  };

  const handleApplyPasted = () => {
    if (pastedText.trim().length === 0) return;
    onApply(pastedText.trim(), "prompt_copy");
    setPastedText("");
    showToast("success", "所感欄に反映しました");
  };

  if (isLoadingSetting || isLoadingTemplate) {
    return <LoadingSpinner label="読み込み中..." />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="w-32">
        <Input
          label="目安文字数"
          type="number"
          value={targetCharCount}
          onChange={(e) => setTargetCharCount(e.target.value)}
        />
      </div>

      {isLoadingMemos ? (
        <LoadingSpinner label="読み込み中..." />
      ) : !hasSharedMemos ? (
        <EmptyState message="送信可能なメモが存在しません" />
      ) : setting.hasKey ? (
        <>
          <InlineMessage
            variant="info"
            message="「共有する」区分のメモが仮名化された状態で外部のAIサービスに送信されます"
          />
          <Button
            variant="primary"
            size="sm"
            className="self-start"
            loading={generateComment.isPending}
            onClick={handleGenerate}
          >
            生成して所感欄に反映
          </Button>
          {generateComment.isPending && (
            <LoadingSpinner label="AIが所感を生成しています(数秒〜数十秒かかることがあります)" />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <InlineMessage
            variant="info"
            message="APIキーが未設定のため、プロンプトをコピーして外部のAIサービスに貼り付けてください。「共有する」区分のメモは仮名化された状態でプロンプトに含まれます"
          />
          <Textarea label="プロンプト" value={prompt} readOnly rows={6} />
          <Button variant="outline" size="sm" className="self-start" onClick={handleCopyPrompt}>
            プロンプトをコピー
          </Button>
          <Textarea
            label="AIの応答を貼り付け"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
          />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={handleApplyPasted}
            disabled={pastedText.trim().length === 0}
          >
            所感欄に反映
          </Button>
        </div>
      )}
    </div>
  );
}
