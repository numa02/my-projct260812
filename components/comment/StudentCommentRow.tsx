"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, History } from "lucide-react";
import { useStudentComments, type CommentCreationMethod } from "@/hooks/useStudentComments";
import { CommentAiAssist } from "./CommentAiAssist";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const CREATION_METHOD_LABEL: Record<CommentCreationMethod, string> = {
  direct_ai: "AI生成(直接呼び出し)",
  prompt_copy: "AI生成(プロンプトコピー運用)",
  manual: "手動作成",
};

export interface StudentCommentRowProps {
  studentId: string;
  studentName: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  /** 生徒名簿からの遷移で指定された生徒の場合、行を目立たせてスクロールする */
  highlighted?: boolean;
}

/**
 * 所感管理画面の1行。氏名と所感入力欄は常時表示し、AI生成(F9, F10)・過去の所感の閲覧(F11)は
 * 折りたたみで必要なときだけ開く。対象期間は画面上部でクラス単位に固定されているため、
 * 行を開いた時点でその生徒・その期間の既存所感があれば初期表示し、なければ空欄から始まる
 * (期間切り替え時は呼び出し側でkeyを変えて本コンポーネントごと再マウントする想定)
 */
export function StudentCommentRow({
  studentId,
  studentName,
  pseudonymCode,
  periodStartDate,
  periodEndDate,
  highlighted,
}: StudentCommentRowProps) {
  const { showToast } = useToast();
  const { comments, isLoading, saveComment } = useStudentComments(studentId);
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

  const existing = comments.find(
    (c) => c.periodStartDate === periodStartDate && c.periodEndDate === periodEndDate,
  );
  const history = comments.filter(
    (c) => !(c.periodStartDate === periodStartDate && c.periodEndDate === periodEndDate),
  );

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
        studentName={studentName}
        pseudonymCode={pseudonymCode}
        periodStartDate={periodStartDate}
        periodEndDate={periodEndDate}
        existing={existing}
        history={history}
        saveComment={saveComment}
        showToast={showToast}
      />
    </div>
  );
}

interface RowBodyProps {
  studentId: string;
  studentName: string;
  pseudonymCode: string;
  periodStartDate: string;
  periodEndDate: string;
  existing: ReturnType<typeof useStudentComments>["comments"][number] | undefined;
  history: ReturnType<typeof useStudentComments>["comments"];
  saveComment: ReturnType<typeof useStudentComments>["saveComment"];
  showToast: (variant: "success" | "error", message: string) => void;
}

function RowBody({
  studentId,
  studentName,
  pseudonymCode,
  periodStartDate,
  periodEndDate,
  existing,
  history,
  saveComment,
  showToast,
}: RowBodyProps) {
  const [content, setContent] = useState(existing?.content ?? "");
  const [creationMethod, setCreationMethod] = useState<CommentCreationMethod>(
    existing?.creationMethod ?? "manual",
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = (appliedContent: string, method: CommentCreationMethod) => {
    setContent(appliedContent);
    setCreationMethod(method);
  };

  const handleSave = async () => {
    if (content.trim().length === 0) {
      setError("所感を入力してください");
      return;
    }
    setError(null);
    try {
      await saveComment.mutateAsync({
        periodStartDate,
        periodEndDate,
        content: content.trim(),
        creationMethod,
      });
      showToast("success", `${studentName}の所感を保存しました`);
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
        aria-label={`${studentName}の所感`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="所感を入力するか、AIで生成してください"
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
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History className="h-4 w-4" aria-hidden />
            過去の所感を見る({history.length}件)
          </Button>
        )}
      </div>

      {aiOpen && (
        <CommentAiAssist
          studentId={studentId}
          pseudonymCode={pseudonymCode}
          periodStartDate={periodStartDate}
          periodEndDate={periodEndDate}
          onApply={handleApply}
        />
      )}

      {historyOpen && (
        <div className="flex flex-col gap-2">
          {history.map((c) => (
            <Card
              key={c.id}
              title={`${c.periodStartDate} 〜 ${c.periodEndDate}`}
              meta={
                <div className="flex items-center gap-2">
                  <Badge variant={c.creationMethod} label={CREATION_METHOD_LABEL[c.creationMethod]} />
                  <span>{new Date(c.updatedAt).toLocaleString("ja-JP")}</span>
                </div>
              }
              body={c.content}
            />
          ))}
        </div>
      )}
    </div>
  );
}
