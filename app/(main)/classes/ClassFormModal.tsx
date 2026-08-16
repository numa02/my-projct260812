"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useClasses, type ClassRow } from "@/hooks/useClasses";
import { parseRpcError } from "@/lib/rpc-error";

const TOKUSHI_GRADE = "特支";

export interface ClassFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 指定時は編集モード。未指定は新規作成モード */
  editingClass?: ClassRow;
}

export function ClassFormModal({ open, onClose, editingClass }: ClassFormModalProps) {
  const isEditMode = Boolean(editingClass);
  const { createClass, updateClassDisplayName, updateClassGrade } = useClasses();
  const { showToast } = useToast();

  const [isTokushi, setIsTokushi] = useState(editingClass?.grade === TOKUSHI_GRADE);
  const [grade, setGrade] = useState(
    editingClass && editingClass.grade !== TOKUSHI_GRADE ? editingClass.grade : "",
  );
  const [displayName, setDisplayName] = useState(editingClass?.displayName ?? "");
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pendingGradeChange, setPendingGradeChange] = useState<string | null>(null);

  const resetAndClose = () => {
    setIsTokushi(false);
    setGrade("");
    setDisplayName("");
    setGradeError(null);
    setNameError(null);
    setPendingGradeChange(null);
    onClose();
  };

  const validate = (): boolean => {
    let valid = true;
    if (!isTokushi && grade.trim().length === 0) {
      setGradeError("学年を入力してください");
      valid = false;
    } else {
      setGradeError(null);
    }
    if (displayName.trim().length === 0) {
      setNameError("クラス表示名を入力してください");
      valid = false;
    } else {
      setNameError(null);
    }
    return valid;
  };

  const newGrade = isTokushi ? TOKUSHI_GRADE : grade.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isEditMode) {
      try {
        await createClass.mutateAsync({ grade: newGrade, displayName: displayName.trim() });
        showToast("success", "クラスを作成しました");
        resetAndClose();
      } catch {
        showToast("error", "クラスの作成に失敗しました");
      }
      return;
    }

    // 編集モード: 学年が変わる場合は確認ダイアログを挟む
    if (newGrade !== editingClass!.grade) {
      setPendingGradeChange(newGrade);
      return;
    }

    await saveDisplayNameOnly();
  };

  const saveDisplayNameOnly = async () => {
    if (displayName.trim() === editingClass!.displayName) {
      resetAndClose();
      return;
    }
    try {
      await updateClassDisplayName.mutateAsync({
        classId: editingClass!.id,
        displayName: displayName.trim(),
      });
      showToast("success", "クラスを更新しました");
      resetAndClose();
    } catch {
      showToast("error", "クラスの更新に失敗しました");
    }
  };

  const confirmGradeChange = async () => {
    try {
      await updateClassGrade.mutateAsync({
        classId: editingClass!.id,
        newGrade: pendingGradeChange!,
      });
      if (displayName.trim() !== editingClass!.displayName) {
        await updateClassDisplayName.mutateAsync({
          classId: editingClass!.id,
          displayName: displayName.trim(),
        });
      }
      showToast("success", "クラスを更新しました");
      resetAndClose();
    } catch (err) {
      const { message } = parseRpcError(err as Error);
      showToast("error", message || "クラスの更新に失敗しました");
      setPendingGradeChange(null);
    }
  };

  const saving =
    createClass.isPending || updateClassDisplayName.isPending || updateClassGrade.isPending;

  return (
    <>
      <Modal title={isEditMode ? "クラスを編集" : "クラスを作成"} open={open} onClose={resetAndClose}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Toggle
              checked={isTokushi}
              onChange={setIsTokushi}
              label="特別支援学級(特支)として登録する"
            />
            特別支援学級(特支)として登録する
          </div>
          {!isTokushi && (
            <Input
              label="学年"
              placeholder="例: 1"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              error={gradeError ?? undefined}
            />
          )}
          <Input
            label="クラス表示名"
            placeholder="例: 1年2組"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={nameError ?? undefined}
          />
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={resetAndClose}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              保存
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        title="学年を変更しますか"
        body="学年を変更すると、以降このクラスの仮名コードが変わります。過去にAIへ送信済みの仮名コードはそのままです。"
        open={pendingGradeChange !== null}
        loading={updateClassGrade.isPending}
        onConfirm={confirmGradeChange}
        onCancel={() => setPendingGradeChange(null)}
      />
    </>
  );
}
