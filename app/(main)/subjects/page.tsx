"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { useSubjects, type SubjectRow } from "@/hooks/useSubjects";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { parseRpcError } from "@/lib/rpc-error";

export default function SubjectsPage() {
  const { subjects, isLoading, createSubject, updateSubject, deleteSubject } = useSubjects();
  const { showToast } = useToast();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length === 0) return;
    try {
      await createSubject.mutateAsync(newName.trim());
      setNewName("");
      showToast("success", "科目を登録しました");
    } catch {
      showToast("error", "科目の登録に失敗しました");
    }
  };

  const startEdit = (subject: SubjectRow) => {
    setEditingId(subject.id);
    setEditingName(subject.name);
  };

  const saveEdit = async () => {
    if (!editingId || editingName.trim().length === 0) return;
    try {
      await updateSubject.mutateAsync({ id: editingId, name: editingName.trim() });
      showToast("success", "科目名を更新しました");
      setEditingId(null);
    } catch {
      showToast("error", "科目名の更新に失敗しました");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSubject.mutateAsync(deleteTarget.id);
      showToast("success", "科目を削除しました");
      setDeleteTarget(null);
    } catch (err) {
      const { message } = parseRpcError(err as Error);
      showToast("error", message || "科目の削除に失敗しました");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">科目管理</h1>

      <form onSubmit={handleCreate} className="flex items-end gap-3">
        <div className="w-64">
          <Input
            label="科目名"
            placeholder="例: 国語"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" loading={createSubject.isPending}>
          登録
        </Button>
      </form>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full max-w-md" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState message="まだ科目が登録されていません" />
      ) : (
        <ul className="flex max-w-md flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center justify-between gap-2 px-4 py-2">
              {editingId === subject.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-sm border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    aria-label="保存"
                    className="rounded-sm p-1 text-gray-500 hover:bg-gray-100"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="キャンセル"
                    className="rounded-sm p-1 text-gray-500 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-700">{subject.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(subject)}
                      aria-label={`${subject.name}を編集`}
                      className="rounded-sm p-1 text-gray-500 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(subject)}
                      aria-label={`${subject.name}を削除`}
                      className="rounded-sm p-1 text-gray-500 hover:bg-gray-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        title="科目を削除しますか"
        body={`「${deleteTarget?.name}」を削除します。この操作は取り消せません。`}
        variant="danger"
        confirmLabel="削除する"
        open={deleteTarget !== null}
        loading={deleteSubject.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
