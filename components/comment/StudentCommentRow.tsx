"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useStudentComments, type CommentCreationMethod } from "@/hooks/useStudentComments";
import { CommentAiAssist } from "./CommentAiAssist";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { CommentKind } from "@/shared/schemas";

const CREATION_METHOD_LABEL: Record<CommentCreationMethod, string> = {
  direct_ai: "AI生成(直接呼び出し)",
  prompt_copy: "AI生成(プロンプトコピー運用)",
  manual: "手動作成",
};

export interface StudentCommentRowProps {
  studentId: string;
  /** learning=学習の所見、life=生活の所見 */
  kind: CommentKind;
  studentName: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  /** 生徒名簿からの遷移で指定された生徒の場合、行を目立たせてスクロールする */
  highlighted?: boolean;
}

/**
 * 所見管理画面の1行。氏名と所見入力欄は常時表示し、AI生成(F9, F10)は折りたたみで
 * 必要なときだけ開く。所見は生徒につき常に最新1件のみを保持するため、行を開いた時点で
 * その生徒の既存所見があれば初期表示し、なければ空欄から始まる
 */
export function StudentCommentRow({
  studentId,
  kind,
  studentName,
  pseudonymCode,
  periodStartDate,
  periodEndDate,
  highlighted,
}: StudentCommentRowProps) {
  const { showToast } = useToast();
  const { comment, isLoading, saveComment } = useStudentComments(studentId, kind);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // 初回マウント時にのみスクロールする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-b-0">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={`${studentName}の行`}
      className={cn(
        "flex flex-col gap-3 border-b border-gray-100 py-4 last:border-b-0",
        highlighted && "-mx-3 rounded-md border border-gray-300 bg-gray-100 px-3",
      )}
    >
      <RowBody
        studentId={studentId}
        kind={kind}
        studentName={studentName}
        pseudonymCode={pseudonymCode}
        periodStartDate={periodStartDate}
        periodEndDate={periodEndDate}
        existing={comment}
        saveComment={saveComment}
        showToast={showToast}
      />
    </div>
  );
}

interface RowBodyProps {
  studentId: string;
  kind: CommentKind;
  studentName: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  existing: ReturnType<typeof useStudentComments>["comment"];
  saveComment: ReturnType<typeof useStudentComments>["saveComment"];
  showToast: (variant: "success" | "error", message: string) => void;
}

function RowBody({
  studentId,
  kind,
  studentName,
  pseudonymCode,
  periodStartDate,
  periodEndDate,
  existing,
  saveComment,
  showToast,
}: RowBodyProps) {
  // 学習の所見は従来の表記(「所見」)のまま、生活の所見のみ「生活の所見」と明示する
  const commentLabel = kind === "life" ? "生活の所見" : "所見";
  const [content, setContent] = useState(existing?.content ?? "");
  const [creationMethod, setCreationMethod] = useState<CommentCreationMethod>(
    existing?.creationMethod ?? "manual",
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = (appliedContent: string, method: CommentCreationMethod) => {
    setContent(appliedContent);
    setCreationMethod(method);
  };

  const handleSave = async () => {
    if (content.trim().length === 0) {
      setError(`${commentLabel}を入力してください`);
      return;
    }
    setError(null);
    try {
      await saveComment.mutateAsync({
        content: content.trim(),
        creationMethod,
      });
      showToast("success", `${studentName}の${commentLabel}を保存しました`);
    } catch {
      setError("保存に失敗しました。もう一度お試しください");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{studentName}</span>
        <CodeBadge code={pseudonymCode} />
        {existing && (
          <>
            <Badge variant={existing.creationMethod} label={CREATION_METHOD_LABEL[existing.creationMethod]} />
            <span className="text-xs text-gray-500">
              最終更新: {new Date(existing.updatedAt).toLocaleString("ja-JP")}
            </span>
          </>
        )}
      </div>

      <Textarea
        aria-label={`${studentName}の${commentLabel}`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder={`${commentLabel}を入力するか、AIで生成してください`}
      />

      {error && <p className="text-sm text-error-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" loading={saveComment.isPending} onClick={handleSave}>
          保存
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={aiOpen}
          onClick={() => setAiOpen((v) => !v)}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          AIで生成する
        </Button>
      </div>

      {aiOpen && (
        <CommentAiAssist
          studentId={studentId}
          kind={kind}
          pseudonymCode={pseudonymCode}
          periodStartDate={periodStartDate}
          periodEndDate={periodEndDate}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
