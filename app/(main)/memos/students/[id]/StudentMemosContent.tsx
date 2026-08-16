"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useClassOptions } from "@/hooks/useClassOptions";
import { useStudentMemos, type StudentMemoRow } from "@/hooks/useStudentMemos";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type ViewMode = "date" | "subject";

export interface StudentMemosContentProps {
  initialClassId: string | null;
  initialStudentId: string | null;
  from: string | null;
}

function groupBySubject(memos: StudentMemoRow[]): Array<{ subjectName: string; memos: StudentMemoRow[] }> {
  const groups: Array<{ subjectName: string; memos: StudentMemoRow[] }> = [];
  for (const memo of memos) {
    const group = groups.find((g) => g.subjectName === memo.subjectName);
    if (group) {
      group.memos.push(memo);
    } else {
      groups.push({ subjectName: memo.subjectName, memos: [memo] });
    }
  }
  return groups;
}

export function StudentMemosContent({
  initialClassId,
  initialStudentId,
  from,
}: StudentMemosContentProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const { classes, isLoadingClasses, selectedClassId, setSelectedClassId, students, isLoadingStudents } =
    useClassOptions(initialClassId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId);
  const [viewMode, setViewMode] = useState<ViewMode>("date");
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentMemoRow | null>(null);

  const { memos, isLoading: isLoadingMemos, updateMemo, deleteMemo } = useStudentMemos(selectedStudentId);

  const startEdit = (memo: StudentMemoRow) => {
    setEditingMemoId(memo.id);
    setEditContent(memo.content);
  };

  const saveEdit = async () => {
    if (!editingMemoId || editContent.trim().length === 0) return;
    try {
      await updateMemo.mutateAsync({ id: editingMemoId, content: editContent.trim() });
      showToast("success", "メモを更新しました");
      setEditingMemoId(null);
    } catch {
      showToast("error", "メモの更新に失敗しました");
    }
  };

  const handleToggleShare = async (memo: StudentMemoRow, checked: boolean) => {
    try {
      await updateMemo.mutateAsync({ id: memo.id, shareFlag: checked ? "shared" : "private" });
      showToast(
        "success",
        "共有区分を更新しました(過去にAIへ送信済みの内容そのものは取り消せません)",
      );
    } catch {
      showToast("error", "共有区分の更新に失敗しました");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMemo.mutateAsync(deleteTarget.id);
      showToast("success", "メモを削除しました");
      setDeleteTarget(null);
    } catch {
      showToast("error", "削除に失敗しました");
    }
  };

  const renderMemoRow = (memo: StudentMemoRow) => (
    <div key={memo.id} className="flex flex-col gap-2 border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-gray-500">
          {memo.noteDate} ・ {memo.period}限 ・ {memo.subjectName}
        </span>
        <div className="flex items-center gap-2">
          <Toggle
            checked={memo.shareFlag === "shared"}
            onChange={(checked) => handleToggleShare(memo, checked)}
            disabled={updateMemo.isPending}
            label={`${memo.noteDate} ${memo.period}限 ${memo.subjectName}の共有区分`}
          />
          <span className="text-sm text-gray-700">
            {memo.shareFlag === "shared" ? "共有する" : "共有しない"}
          </span>
          <button
            type="button"
            onClick={() => startEdit(memo)}
            aria-label={`${memo.noteDate} ${memo.period}限 ${memo.subjectName}のメモを編集`}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(memo)}
            aria-label={`${memo.noteDate} ${memo.period}限 ${memo.subjectName}のメモを削除`}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {editingMemoId === memo.id ? (
        <div className="flex flex-col gap-2">
          <Textarea
            label="メモ"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={updateMemo.isPending} onClick={saveEdit}>
              保存
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingMemoId(null)}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-700">{memo.content}</p>
      )}
    </div>
  );

  if (!isLoadingClasses && classes.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">生徒別メモ一覧</h1>
        <EmptyState
          message="まだクラスが登録されていません"
          actionLabel="クラス管理画面へ"
          onAction={() => router.push("/classes")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">生徒別メモ一覧</h1>
        {from && (
          <Button variant="outline" size="sm" onClick={() => router.push(from)}>
            戻る
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="クラス"
            options={classes.map((c) => ({ value: c.id, label: c.displayName }))}
            value={selectedClassId ?? ""}
            onChange={(id) => {
              setSelectedClassId(id);
              setSelectedStudentId(null);
            }}
          />
        </div>
        {selectedClassId && (
          <div className="w-64">
            <Select
              label="生徒"
              options={students.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedStudentId ?? ""}
              onChange={setSelectedStudentId}
              emptyMessage="このクラスにはまだ生徒が登録されていません"
            />
          </div>
        )}
        {selectedStudentId && (
          <SegmentedControl
            aria-label="表示切替"
            options={[
              { value: "date", label: "日付順" },
              { value: "subject", label: "教科別" },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
          />
        )}
      </div>

      {!selectedClassId ? null : isLoadingStudents ? (
        <LoadingSpinner label="読み込み中..." />
      ) : !selectedStudentId ? (
        <EmptyState message="生徒を選択してください" />
      ) : isLoadingMemos ? (
        <LoadingSpinner label="読み込み中..." />
      ) : memos.length === 0 ? (
        <EmptyState message="まだメモがありません" />
      ) : viewMode === "date" ? (
        <div className="flex flex-col rounded-md border border-gray-200 px-4">
          {memos.map(renderMemoRow)}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupBySubject(memos).map((group) => (
            <div key={group.subjectName} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-gray-900">{group.subjectName}</h2>
              <div className="flex flex-col rounded-md border border-gray-200 px-4">
                {group.memos.map(renderMemoRow)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        title="メモを削除しますか"
        body="このメモを削除します。この操作は取り消せません。"
        variant="danger"
        confirmLabel="削除する"
        open={deleteTarget !== null}
        loading={deleteMemo.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
