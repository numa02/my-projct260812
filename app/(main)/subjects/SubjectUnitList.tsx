"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useUnits, type UnitRow } from "@/hooks/useUnits";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { unitInputSchema } from "@/shared/schemas";

export interface SubjectUnitListProps {
  subjectId: string;
  subjectName: string;
}

/**
 * 科目管理画面で科目の行を開いたときに表示する、その科目の単元の一覧・追加・編集・削除。
 * 単元は登録順に並ぶ(並び替えUIはスコープ外。教科書の順に登録すれば自然な順になる)
 */
export function SubjectUnitList({ subjectId, subjectName }: SubjectUnitListProps) {
  const { showToast } = useToast();
  const { units, isLoading, createUnit, updateUnit, deleteUnit } = useUnits(subjectId);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = unitInputSchema.safeParse({ name: newName });
    if (!parsed.success) return;
    try {
      await createUnit.mutateAsync(parsed.data.name);
      setNewName("");
      showToast("success", "単元を登録しました");
    } catch {
      // 入力内容は保持したまま、再度保存できる状態を維持する(F13)
      showToast("error", "単元の登録に失敗しました");
    }
  };

  const saveEdit = async () => {
    const parsed = unitInputSchema.safeParse({ name: editingName });
    if (!editingId || !parsed.success) return;
    try {
      await updateUnit.mutateAsync({ id: editingId, name: parsed.data.name });
      showToast("success", "単元名を更新しました");
      setEditingId(null);
    } catch {
      showToast("error", "単元名の更新に失敗しました");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUnit.mutateAsync(deleteTarget.id);
      showToast("success", "単元を削除しました");
      setDeleteTarget(null);
    } catch {
      showToast("error", "単元の削除に失敗しました");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3">
      <h3 className="text-sm font-medium text-gray-700">単元</h3>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <p className="text-sm text-gray-500">まだ単元が登録されていません</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-center justify-between gap-2 py-1">
              {editingId === unit.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    aria-label={`${unit.name}の単元名`}
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
                  <span className="text-sm text-gray-700">{unit.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(unit.id);
                        setEditingName(unit.name);
                      }}
                      aria-label={`単元「${unit.name}」を編集`}
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(unit)}
                      aria-label={`単元「${unit.name}」を削除`}
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

      <form onSubmit={handleCreate} className="flex items-end gap-2">
        <div className="w-56">
          <Input
            label={`${subjectName}の単元名`}
            placeholder="例: 分数のかけ算"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          loading={createUnit.isPending}
          disabled={newName.trim().length === 0}
        >
          単元を追加
        </Button>
      </form>

      <ConfirmDialog
        title="単元を削除しますか"
        body={`「${deleteTarget?.name}」を削除します。この単元を使っているメモは単元未設定に戻ります(メモは削除されません)。この操作は取り消せません。`}
        variant="danger"
        confirmLabel="削除する"
        open={deleteTarget !== null}
        loading={deleteUnit.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
