"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export interface UnitCommentDraftCardProps {
  unitName: string;
  /** その単元の材料メモの件数 */
  memoCount: number;
  /** 直接生成かプロンプトコピー運用か。親の作成方法の選択に従う */
  method: "direct" | "prompt";
  /** この単元ぶんの組み立て済みプロンプト(プロンプトコピー運用で表示・コピーする) */
  prompt: string;
  /** 生成済み・貼り付け済みの所見案。まだなければnull */
  draft: string | null;
  generating: boolean;
  error: string | null;
  /** 所見欄に反映する対象として選択されているか */
  selected: boolean;
  onToggleSelected: (selected: boolean) => void;
  /** カード内で所見案を編集したとき */
  onChangeDraft: (content: string) => void;
  /** 直接生成を実行する(順次実行の制御は親が持つ) */
  onGenerate: () => void;
  /** AIの応答を貼り付けて案として採り込む */
  onApplyPasted: (text: string) => void;
}

/**
 * 「単元ごとに生成」の単元1件分のカード(F9, F10)。
 * 所見案はこのカードでは保存せず、親が選択結果を連結して行の所見欄に反映する
 */
export function UnitCommentDraftCard({
  unitName,
  memoCount,
  method,
  prompt,
  draft,
  generating,
  error,
  selected,
  onToggleSelected,
  onChangeDraft,
  onGenerate,
  onApplyPasted,
}: UnitCommentDraftCardProps) {
  const [pastedText, setPastedText] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyError(null);
    } catch {
      setCopyError("コピーに失敗しました");
    }
  };

  const handleApplyPasted = () => {
    if (pastedText.trim().length === 0) return;
    onApplyPasted(pastedText.trim());
    setPastedText("");
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelected(e.target.checked)}
            // 案がまだないカードは選べない(反映しても何も入らないため)
            disabled={draft === null || draft.trim().length === 0}
            className="h-4 w-4 rounded-sm border-gray-300"
            aria-label={`${unitName}の案を採用する`}
          />
          {unitName}
          <span className="text-xs font-normal text-gray-500">メモ{memoCount}件</span>
        </label>
        {method === "direct" && (
          <Button variant="outline" size="sm" loading={generating} onClick={onGenerate}>
            生成
          </Button>
        )}
      </div>

      {generating && <LoadingSpinner label={`${unitName}の所見案を生成しています`} />}

      {/* エラーは既存の行内エラー表示(StudentCommentRow等)と同じ形にする */}
      {error && <p className="text-sm text-error-500">{error}</p>}

      {draft !== null ? (
        <div className="flex flex-col gap-1">
          <Textarea
            aria-label={`${unitName}の所見案`}
            value={draft}
            onChange={(e) => onChangeDraft(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-gray-500">{draft.trim().length}字</p>
        </div>
      ) : (
        !generating &&
        method === "direct" && <p className="text-sm text-gray-500">まだ生成していません</p>
      )}

      {method === "prompt" && (
        <div className="flex flex-col gap-2">
          <Textarea aria-label={`${unitName}のプロンプト`} value={prompt} readOnly rows={4} />
          <Button variant="outline" size="sm" className="self-start" onClick={handleCopyPrompt}>
            プロンプトをコピー
          </Button>
          {copyError && <p className="text-sm text-error-500">{copyError}</p>}
          <Textarea
            label={`${unitName}のAIの応答を貼り付け`}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={4}
          />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={handleApplyPasted}
            disabled={pastedText.trim().length === 0}
          >
            この単元の案にする
          </Button>
        </div>
      )}
    </div>
  );
}
