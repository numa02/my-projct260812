"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";

type ShareFlag = "shared" | "private";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface StudentMemoRowProps {
  initialContent: string;
  initialShareFlag: ShareFlag;
  saveMemo: AsyncAction<{ studentId: string; content: string; shareFlag: ShareFlag }>;
  studentId: string;
}

/** 授業記録画面の展開行。他の生徒の行の状態には一切影響しない、独立した下書き・保存を持つ */
export function StudentMemoRow({
  initialContent,
  initialShareFlag,
  saveMemo,
  studentId,
}: StudentMemoRowProps) {
  const { showToast } = useToast();
  const [content, setContent] = useState(initialContent);
  const [shareFlag, setShareFlag] = useState<ShareFlag>(initialShareFlag);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (content.trim().length === 0) {
      setError("メモを入力してください");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveMemo.mutateAsync({ studentId, content: content.trim(), shareFlag });
      showToast("success", "メモを保存しました");
    } catch {
      setError("保存に失敗しました。もう一度お試しください");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="メモ"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />

      <div className="flex items-center gap-2">
        <Toggle
          checked={shareFlag === "shared"}
          onChange={(checked) => setShareFlag(checked ? "shared" : "private")}
          label="共有区分"
        />
        <span className="text-sm text-gray-700">
          {shareFlag === "shared" ? "共有する" : "共有しない"}
        </span>
      </div>

      {shareFlag === "shared" && (
        <InlineMessage
          variant="info"
          message="本文に書いた氏名等の情報はそのままAIへ送信されます"
        />
      )}

      {error && <p className="text-sm text-error-500">{error}</p>}

      <Button variant="primary" size="sm" className="self-start" loading={saving} onClick={handleSave}>
        保存
      </Button>
    </div>
  );
}
