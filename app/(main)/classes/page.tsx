"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useClasses, type ClassRow } from "@/hooks/useClasses";
import { Table } from "@/components/ui/Table";
import { CardList } from "@/components/ui/CardList";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { parseRpcError } from "@/lib/rpc-error";
import { ClassFormModal } from "./ClassFormModal";

export default function ClassesPage() {
  const { classes, isLoading, deleteClass, checkClassUsage } = useClasses();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleteDialogBody, setDeleteDialogBody] = useState<string>("");
  const [checkingUsage, setCheckingUsage] = useState(false);

  const openCreateForm = () => {
    setEditingClass(undefined);
    setFormOpen(true);
  };

  const openEditForm = (klass: ClassRow) => {
    setEditingClass(klass);
    setFormOpen(true);
  };

  const handleDeleteClick = async (klass: ClassRow) => {
    setCheckingUsage(true);
    try {
      const { studentCount, usedInTimetable } = await checkClassUsage(klass.id);
      if (studentCount > 0) {
        showToast("error", "生徒が登録されているため削除できません。先に生徒名簿から生徒を削除してください");
        return;
      }
      setDeleteDialogBody(
        usedInTimetable
          ? "このクラスは時間割で使用中です。削除すると該当するマスは未設定に戻ります。削除してもよろしいですか。"
          : "このクラスを削除します。この操作は取り消せません。削除してもよろしいですか。",
      );
      setDeleteTarget(klass);
    } finally {
      setCheckingUsage(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClass.mutateAsync(deleteTarget.id);
      showToast("success", "クラスを削除しました");
      setDeleteTarget(null);
    } catch (err) {
      const { message } = parseRpcError(err as Error);
      showToast("error", message || "クラスの削除に失敗しました");
      setDeleteTarget(null);
    }
  };

  // 組番号は仮名コード生成のための内部的な連番であり、採番規則(学年区分ごとの作成順・欠番は
  // 再利用しない)を教員が知る必要がないため一覧には表示しない(docs/features/ui-clarity/)
  const columns = [
    {
      key: "grade",
      header: "学年",
      render: (c: ClassRow) => c.grade,
    },
    {
      key: "displayName",
      header: "クラス表示名",
      render: (c: ClassRow) => c.displayName,
    },
    {
      key: "actions",
      header: "",
      render: (c: ClassRow) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEditForm(c)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            編集
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteClick(c)}
            disabled={checkingUsage}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            削除
          </Button>
        </div>
      ),
    },
  ];

  const emptyState = (
    <EmptyState
      message="まだクラスがありません。最初のクラスを作成してください"
      actionLabel="クラスを作成"
      onAction={openCreateForm}
    />
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">クラス管理</h1>
        {classes.length > 0 && (
          <Button variant="primary" onClick={openCreateForm}>
            クラスを作成
          </Button>
        )}
      </div>

      {!isLoading && classes.length === 0 ? (
        emptyState
      ) : (
        <>
          <div className="hidden desktop:block">
            <Table columns={columns} rows={classes} rowKey={(c) => c.id} loading={isLoading} />
          </div>
          <div className="desktop:hidden">
            <CardList
              rows={classes}
              rowKey={(c) => c.id}
              loading={isLoading}
              renderItem={(c) => (
                <Card
                  title={c.displayName}
                  meta={c.grade}
                  body={
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditForm(c)}>
                        編集
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteClick(c)}>
                        削除
                      </Button>
                    </div>
                  }
                />
              )}
            />
          </div>
        </>
      )}

      <ClassFormModal
        key={editingClass?.id ?? "create"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingClass={editingClass}
      />

      <ConfirmDialog
        title="クラスを削除しますか"
        body={deleteDialogBody}
        variant="danger"
        confirmLabel="削除する"
        open={deleteTarget !== null}
        loading={deleteClass.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
