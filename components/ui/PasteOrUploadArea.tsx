"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { Textarea } from "./Input";

export interface ImportErrorRow {
  rowIndex: number;
  reason: string;
  attendanceNumber?: string | null;
  name?: string | null;
}

const REASON_LABEL: Record<string, string> = {
  MISSING_FIELD: "出席番号または氏名が空です",
  DUPLICATE_IN_BATCH: "取り込みデータ内で出席番号が重複しています",
  DUPLICATE_EXISTING: "既存の生徒と出席番号が重複しています",
};

export interface PasteOrUploadAreaProps {
  onImport: (rawText: string) => void;
  errorRows?: ImportErrorRow[];
  loading?: boolean;
}

/** CSVアップロード欄とテキスト貼り付け欄(列順:出席番号,氏名。区切り文字はカンマ/タブ自動判定) */
export function PasteOrUploadArea({ onImport, errorRows = [], loading }: PasteOrUploadAreaProps) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    const text = await file.text();
    onImport(text);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="生徒名簿の取り込み方法"
        options={[
          { value: "upload", label: "ファイルアップロード" },
          { value: "paste", label: "テキスト貼り付け" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as "upload" | "paste")}
      />

      {mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center",
            dragOver ? "border-gray-900 bg-gray-100" : "border-gray-300 bg-gray-50",
          )}
        >
          <Upload className="h-6 w-6 text-gray-400" aria-hidden />
          <p className="text-sm text-gray-600">
            CSVファイルをドラッグ&ドロップ、またはファイルを選択してください
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            aria-label="生徒名簿CSVファイル"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            ファイルを選択
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Textarea
            label="出席番号,氏名 の形式で貼り付けてください(ヘッダー行なし)"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
          />
          <Button
            variant="primary"
            onClick={() => onImport(pastedText)}
            loading={loading}
            disabled={pastedText.trim().length === 0}
            className="self-start"
          >
            取り込む
          </Button>
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="rounded-md border border-error-500/30 bg-error-500/5 p-3">
          <p className="mb-2 text-sm font-medium text-error-500">
            {errorRows.length}件のエラーがあります
          </p>
          <ul className="flex flex-col gap-1 text-sm text-gray-700">
            {errorRows.map((row) => (
              <li key={row.rowIndex}>
                {row.rowIndex}行目: {REASON_LABEL[row.reason] ?? row.reason}
                {row.name ? `(${row.name})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
