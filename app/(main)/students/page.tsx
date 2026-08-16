"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Sparkles } from "lucide-react";
import { useClassOptions } from "@/hooks/useClassOptions";
import { useStudents, type StudentRow } from "@/hooks/useStudents";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { PasteOrUploadArea, type ImportErrorRow } from "@/components/ui/PasteOrUploadArea";
import { Table } from "@/components/ui/Table";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { computePseudonymCode } from "@/shared/pseudonym";
import { parseStudentRows } from "@/shared/parse-student-rows";

export default function StudentsPage() {
  const router = useRouter();
  const { classes, isLoadingClasses, selectedClassId, setSelectedClassId } = useClassOptions();
  const { students, isLoading: isLoadingStudents, importStudents, updateStudent, deleteStudent } =
    useStudents(selectedClassId);
  const { showToast } = useToast();

  const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  // 取り込み成功後に貼り付け欄をクリアするため、キーを変えてPasteOrUploadAreaを再マウントする
  const [importAreaKey, setImportAreaKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAttendanceNumber, setEditAttendanceNumber] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleImport = async (rawText: string) => {
    const rows = parseStudentRows(rawText);
    if (rows.length === 0) return;
    try {
      const result = await importStudents.mutateAsync(rows);
      setImportErrors(result.errors);
      if (result.imported.length > 0) {
        showToast("success", `${result.imported.length}件の生徒を登録しました`);
        setImportAreaKey((k) => k + 1);
      }
      // エラー件数は取り込み欄下の一覧(常時表示)で確認できるため、トーストでは重ねて出さない
    } catch {
      showToast("error", "インポートに失敗しました");
    }
  };

  const startEdit = (student: StudentRow) => {
    setEditingId(student.id);
    setEditAttendanceNumber(String(student.attendanceNumber));
    setEditName(student.name);
  };

  const saveEdit = async () => {
    const attendanceNumber = Number(editAttendanceNumber);
    if (!editingId || !Number.isInteger(attendanceNumber) || editName.trim().length === 0) return;
    try {
      await updateStudent.mutateAsync({
        id: editingId,
        attendanceNumber,
        name: editName.trim(),
      });
      showToast("success", "生徒情報を更新しました");
      setEditingId(null);
    } catch {
      showToast("error", "出席番号が重複しているか、更新に失敗しました");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStudent.mutateAsync(deleteTarget.id);
      showToast("success", "生徒を削除しました");
      setDeleteTarget(null);
    } catch {
      showToast("error", "削除に失敗しました");
    }
  };

  if (!isLoadingClasses && classes.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">生徒名簿</h1>
        <EmptyState
          message="まだクラスが登録されていません"
          actionLabel="クラス管理画面へ"
          onAction={() => router.push("/classes")}
        />
      </div>
    );
  }

  const columns = [
    {
      key: "attendanceNumber",
      header: "出席番号",
      render: (s: StudentRow) => s.attendanceNumber,
    },
    {
      key: "name",
      header: "氏名",
      render: (s: StudentRow) =>
        editingId === s.id ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-32 rounded-sm border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={`/memos/students/${s.id}?from=/students`}
              className="font-medium text-gray-900 hover:underline"
            >
              {s.name}
            </Link>
            {selectedClass && (
              <CodeBadge
                code={computePseudonymCode({
                  grade: selectedClass.grade,
                  groupNumber: selectedClass.groupNumber,
                  attendanceNumber: s.attendanceNumber,
                })}
              />
            )}
          </div>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (s: StudentRow) =>
        editingId === s.id ? (
          <div className="flex justify-end gap-2">
            <input
              value={editAttendanceNumber}
              onChange={(e) => setEditAttendanceNumber(e.target.value)}
              className="w-16 rounded-sm border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="出席番号"
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
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Link
              href={`/comments/students/${s.id}`}
              aria-label={`${s.name}の所感`}
              className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => startEdit(s)}
              aria-label={`${s.name}を編集`}
              className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(s)}
              aria-label={`${s.name}を削除`}
              className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">生徒名簿</h1>

      <div className="w-64">
        <Select
          label="クラス"
          options={classes.map((c) => ({ value: c.id, label: c.displayName }))}
          value={selectedClassId ?? ""}
          onChange={(id) => {
            setSelectedClassId(id);
            setImportErrors([]);
            setImportAreaKey((k) => k + 1);
          }}
        />
      </div>

      {selectedClassId && (
        <>
          <PasteOrUploadArea
            key={importAreaKey}
            onImport={handleImport}
            errorRows={importErrors}
            loading={importStudents.isPending}
          />

          {isLoadingStudents ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState message="まだ生徒が登録されていません" />
          ) : (
            <Table columns={columns} rows={students} rowKey={(s) => s.id} />
          )}
        </>
      )}

      <ConfirmDialog
        title="生徒を削除しますか"
        body="この生徒を削除すると、記録済みのメモ・所感もすべて完全に削除され、復元できません。"
        variant="danger"
        confirmLabel="削除する"
        open={deleteTarget !== null}
        loading={deleteStudent.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
