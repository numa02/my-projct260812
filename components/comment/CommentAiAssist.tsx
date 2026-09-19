"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { usePromptTemplate } from "@/hooks/usePromptTemplate";
import { useSharedMemosForPeriod } from "@/hooks/useSharedMemosForPeriod";
import { useGenerateComment } from "@/hooks/useGenerateComment";
import type { CommentCreationMethod } from "@/hooks/useStudentComments";
import { buildPrompt } from "@/shared/prompt-builder";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";

type Method = "direct" | "prompt";

export interface CommentAiAssistProps {
  studentId: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  /** 生成・貼り付けた内容を行の所見欄に反映する(この時点ではまだ保存しない) */
  onApply: (content: string, method: CommentCreationMethod) => void;
}

/**
 * 所見一覧画面の行内で折りたたまれるAI生成セクション(F9, F10)。
 * 直接呼び出し・プロンプトコピー運用のどちらを使うかは教員が都度選べる
 * (APIキー設定済みでも、あえてプロンプトコピー運用を選んでよい)。
 * いずれの方法も、結果は自前で保存せずonApplyで行の所見欄(常時表示のテキストエリア)に
 * 反映するだけに留める。保存は行側の責務
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
  // 未選択の場合はAPIキー設定状況から妥当な既定値を出す。教員が選び直したらそちらを優先する
  // (常にstateから直接計算することで、設定の読み込みタイミングに関わらず正しい値になる)
  const [methodOverride, setMethodOverride] = useState<Method | null>(null);
  const method = methodOverride ?? (setting.hasKey ? "direct" : "prompt");

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
      showToast("success", "生成結果を所見欄に反映しました");
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
    showToast("success", "所見欄に反映しました");
  };

  if (isLoadingSetting || isLoadingTemplate) {
    return <LoadingSpinner label="読み込み中..." />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <SegmentedControl
        aria-label="所見の作成方法"
        options={[
          { value: "direct", label: "AIで直接生成" },
          { value: "prompt", label: "プロンプトを作成" },
        ]}
        value={method}
        onChange={(v) => setMethodOverride(v as Method)}
      />

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
      ) : method === "direct" && !setting.hasKey ? (
        <div className="flex flex-col gap-2">
          <InlineMessage
            variant="warning"
            message="APIキーが未設定のため、直接生成はできません。「プロンプトを作成」に切り替えるか、先にAPIキーを登録してください"
          />
          <Link href="/settings/ai-provider" className="text-sm text-gray-700 underline hover:text-gray-900">
            AIプロバイダ設定へ
          </Link>
        </div>
      ) : method === "direct" ? (
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
            生成して所見欄に反映
          </Button>
          {generateComment.isPending && (
            <LoadingSpinner label="AIが所見を生成しています(数秒〜数十秒かかることがあります)" />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <InlineMessage
            variant="info"
            message="「共有する」区分のメモが仮名化された状態でプロンプトに含まれます。コピーして外部のAIサービスに貼り付けてください"
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
            所見欄に反映
          </Button>
        </div>
      )}
    </div>
  );
}
