"use client";

import { useState } from "react";
import { useStudentComments, type CommentCreationMethod, type StudentCommentRow } from "@/hooks/useStudentComments";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const CREATION_METHOD_LABEL: Record<CommentCreationMethod, string> = {
  direct_ai: "AI生成(直接呼び出し)",
  prompt_copy: "AI生成(プロンプトコピー運用)",
  manual: "手動作成",
};

export interface CommentHistoryTabProps {
  studentId: string;
  onSwitchToGenerate: () => void;
}

interface DraftState {
  id: string | null;
  periodStartDate: string;
  periodEndDate: string;
  content: string;
  targetCharCount: string;
  creationMethod: CommentCreationMethod;
}

function emptyDraft(): DraftState {
  return {
    id: null,
    periodStartDate: "",
    periodEndDate: "",
    content: "",
    targetCharCount: "",
    creationMethod: "manual",
  };
}

function draftFromComment(comment: StudentCommentRow): DraftState {
  return {
    id: comment.id,
    periodStartDate: comment.periodStartDate,
    periodEndDate: comment.periodEndDate,
    content: comment.content,
    targetCharCount: comment.targetCharCount != null ? String(comment.targetCharCount) : "",
    creationMethod: comment.creationMethod,
  };
}

/** 所感画面「履歴」タブ。期間別一覧・詳細編集・手動作成に対応する(F11) */
export function CommentHistoryTab({ studentId, onSwitchToGenerate }: CommentHistoryTabProps) {
  const { showToast } = useToast();
  const { comments, isLoading, saveComment } = useStudentComments(studentId);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);

  const isCreating = draft !== null && draft.id === null;
  const isEditing = draft !== null && draft.id !== null;

  const startCreate = () => setDraft(emptyDraft());
  const selectComment = (comment: StudentCommentRow) => setDraft(draftFromComment(comment));
  const cancelDraft = () => setDraft(null);

  const doSave = async () => {
    if (!draft) return;
    try {
      await saveComment.mutateAsync({
        periodStartDate: draft.periodStartDate,
        periodEndDate: draft.periodEndDate,
        content: draft.content.trim(),
        targetCharCount: draft.targetCharCount.trim() ? Number(draft.targetCharCount) : undefined,
        creationMethod: draft.creationMethod,
      });
      showToast("success", "所感を保存しました");
      setOverwriteConfirmOpen(false);
      setDraft(null);
    } catch {
      showToast("error", "保存に失敗しました");
    }
  };

  const handleSaveClick = () => {
    if (!draft || draft.periodStartDate === "" || draft.periodEndDate === "" || draft.content.trim().length === 0) {
      return;
    }
    // 新規作成時のみ、同じ期間の既存所感があれば上書き確認する(編集時は自分自身のレコードを更新するだけなので不要)
    if (isCreating) {
      const existing = comments.find(
        (c) => c.periodStartDate === draft.periodStartDate && c.periodEndDate === draft.periodEndDate,
      );
      if (existing) {
        setOverwriteConfirmOpen(true);
        return;
      }
    }
    doSave();
  };

  if (isLoading) {
    return <LoadingSpinner label="読み込み中..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {comments.length === 0 && !isCreating ? (
        <EmptyState
          message="まだ所感が保存されていません"
          actionLabel="手動で作成する"
          onAction={startCreate}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {comments.length > 0 && (
            <Button variant="outline" size="sm" className="self-start" onClick={startCreate}>
              手動で作成する
            </Button>
          )}
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <Card
                key={comment.id}
                title={`${comment.periodStartDate} 〜 ${comment.periodEndDate}`}
                meta={
                  <div className="flex items-center gap-2">
                    <Badge variant={comment.creationMethod} label={CREATION_METHOD_LABEL[comment.creationMethod]} />
                    <span>{new Date(comment.updatedAt).toLocaleString("ja-JP")}</span>
                  </div>
                }
                body={comment.content}
                selected={draft?.id === comment.id}
                onClick={() => selectComment(comment)}
              />
            ))}
          </div>
        </div>
      )}

      {comments.length === 0 && !isCreating && (
        <p className="text-sm text-gray-500">
          <button type="button" onClick={onSwitchToGenerate} className="underline hover:text-gray-700">
            「生成」タブ
          </button>
          でAIによる所感の生成を試すこともできます
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isCreating ? "所感を手動作成" : "所感を編集"}
          </h2>

          <div className="flex flex-wrap items-end gap-4">
            <Input
              label="開始日"
              type="date"
              value={draft.periodStartDate}
              disabled={isEditing}
              onChange={(e) => setDraft({ ...draft, periodStartDate: e.target.value })}
            />
            <Input
              label="終了日"
              type="date"
              value={draft.periodEndDate}
              disabled={isEditing}
              onChange={(e) => setDraft({ ...draft, periodEndDate: e.target.value })}
            />
            <div className="w-32">
              <Input
                label="目安文字数"
                type="number"
                value={draft.targetCharCount}
                onChange={(e) => setDraft({ ...draft, targetCharCount: e.target.value })}
              />
            </div>
          </div>

          <Textarea
            label="所感"
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            rows={8}
          />

          <div className="flex gap-3">
            <Button variant="primary" loading={saveComment.isPending} onClick={handleSaveClick}>
              保存
            </Button>
            <Button variant="secondary" onClick={cancelDraft}>
              キャンセル
            </Button>
          </div>
        </div>
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
