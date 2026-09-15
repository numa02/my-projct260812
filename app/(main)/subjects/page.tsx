"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { useSubjects, type SubjectRow, type SchoolLevel } from "@/hooks/useSubjects";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PasteOrUploadArea } from "@/components/ui/PasteOrUploadArea";
import { parseRpcError } from "@/lib/rpc-error";
import { parseSubjectGridNames } from "@/shared/parse-subject-grid";

const SUBJECT_PASTE_EXAMPLE = ["国語\t国語\t国語\t国語\t国語", "算数\t算数\t算数\t算数\t算数"].join(
  "\n",
);

const SCHOOL_LEVEL_OPTIONS = [
  { value: "elementary", label: "小学校" },
  { value: "middle", label: "中学校" },
];

export default function SubjectsPage() {
  const {
    subjects,
    isLoading,
    createSubject,
    updateSubject,
    deleteSubject,
    seedStandardSubjects,
    importSubjects,
  } = useSubjects();
  const { showToast } = useToast();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedSchoolLevel, setSeedSchoolLevel] = useState<SchoolLevel>("elementary");
  const [importOpen, setImportOpen] = useState(false);
  // 取り込み成功後に貼り付け欄をクリアするため、キーを変えてPasteOrUploadAreaを再マウントする
  const [importAreaKey, setImportAreaKey] = useState(0);

  const handleSeed = async () => {
    try {
      await seedStandardSubjects.mutateAsync(seedSchoolLevel);
      showToast("success", "標準科目セットを追加しました");
    } catch {
      showToast("error", "標準科目セットの追加に失敗しました");
    }
  };

  const handleImport = async (rawText: string) => {
    const names = parseSubjectGridNames(rawText);
    if (names.length === 0) return;
    try {
      const result = await importSubjects.mutateAsync(names);
      if (result.inserted.length > 0) {
        showToast("success", `${result.inserted.length}件の科目を登録しました`);
        setImportAreaKey((k) => k + 1);
      } else {
        showToast("success", "登録済みの科目のみだったため、新規追加はありませんでした");
      }
    } catch {
      showToast("error", "科目の一括登録に失敗しました");
    }
  };

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

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
        <button
          type="button"
          onClick={() => setSeedOpen((v) => !v)}
          className="flex items-center gap-1 self-start text-sm font-medium text-gray-700"
        >
          <span aria-hidden>{seedOpen ? "▼" : "▶"}</span>
          標準科目セットを追加
        </button>
        {seedOpen && (
          <div className="flex items-end gap-3">
            <div className="w-40">
              <Select
                label="学校区分"
                options={SCHOOL_LEVEL_OPTIONS}
                value={seedSchoolLevel}
                onChange={(v) => setSeedSchoolLevel(v as SchoolLevel)}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              loading={seedStandardSubjects.isPending}
              onClick={handleSeed}
            >
              追加する
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className="flex items-center gap-1 self-start text-sm font-medium text-gray-700"
        >
          <span aria-hidden>{importOpen ? "▼" : "▶"}</span>
          貼り付けで一括登録
        </button>
        {importOpen && (
          <PasteOrUploadArea
            key={importAreaKey}
            onImport={handleImport}
            loading={importSubjects.isPending}
            reasonLabels={{}}
            pasteLabel="時間割表の科目名をそのまま貼り付けてください(同じ科目名は1件にまとめて登録されます)"
            pasteExample={SUBJECT_PASTE_EXAMPLE}
            fileInputAriaLabel="科目一覧ファイル"
            segmentedControlAriaLabel="科目の取り込み方法"
          />
        )}
      </div>

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
                    className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="キャンセル"
                    className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
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
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(subject)}
                      aria-label={`${subject.name}を削除`}
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
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
