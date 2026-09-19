"use client";

import { useState } from "react";
import { Input, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import { lifeMemoInputSchema } from "@/shared/schemas";
import { getTodayISO } from "@/shared/week";

type ShareFlag = "shared" | "private";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface LifeMemoAddFormProps {
  addLifeMemo: AsyncAction<{ noteDate: string; content: string; shareFlag: ShareFlag }>;
  onDone: () => void;
}

/**
 * 生徒別メモ一覧から生活メモを1件追加するフォーム。
 * 週次時間割からの遷移と違い日付が自動で決まらないため、日付は教員が入力・選択する(初期値は今日)
 */
export function LifeMemoAddForm({ addLifeMemo, onDone }: LifeMemoAddFormProps) {
  const { showToast } = useToast();
  const [noteDate, setNoteDate] = useState(getTodayISO);
  const [content, setContent] = useState("");
  const [shareFlag, setShareFlag] = useState<ShareFlag>("shared");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // studentIdは親(生徒の選択状態)が決めるため、フォームでは日付・内容・共有区分のみ検証する
    const parsed = lifeMemoInputSchema.omit({ studentId: true }).safeParse({ noteDate, content, shareFlag });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setError(null);
    try {
      await addLifeMemo.mutateAsync({
        noteDate: parsed.data.noteDate,
        content: parsed.data.content,
        shareFlag: parsed.data.shareFlag,
      });
      showToast("success", "生活メモを追加しました");
      onDone();
    } catch (err) {
      // 入力内容は保持したまま、再度保存できる状態を維持する(F13)
      setError(
        (err as { code?: string }).code === "23505"
          ? "この日付の生活メモは既にあります。一覧から編集してください"
          : "保存に失敗しました。もう一度お試しください",
      );
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-md border border-gray-200 p-4">
      <h2 className="text-base font-semibold text-gray-900">生活メモを追加</h2>
      <div className="w-48">
        <Input label="日付" type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
      </div>
      <Textarea label="生活メモ" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />

      <div className="flex items-center gap-2">
        <Toggle
          checked={shareFlag === "shared"}
          onChange={(checked) => setShareFlag(checked ? "shared" : "private")}
          label="共有区分"
        />
        <span className="text-sm text-gray-700">{shareFlag === "shared" ? "共有する" : "共有しない"}</span>
      </div>

      {shareFlag === "shared" && (
        <InlineMessage variant="info" message="本文に書いた氏名等の情報はそのままAIへ送信されます" />
      )}

      {error && <p className="text-sm text-error-500">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" size="sm" loading={addLifeMemo.isPending} onClick={handleSave}>
          保存
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
