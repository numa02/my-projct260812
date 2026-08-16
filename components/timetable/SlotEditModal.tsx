"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import type { ClassRow } from "@/hooks/useClasses";
import type { SubjectRow } from "@/hooks/useSubjects";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金"];

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface SlotEditModalProps {
  weekday: number;
  period: number;
  dateISO: string;
  initialSubjectId: string | null;
  initialClassId: string | null;
  isOverridden: boolean;
  subjects: SubjectRow[];
  classes: ClassRow[];
  onClose: () => void;
  saveOverride: AsyncAction<{
    weekday: number;
    period: number;
    subjectId?: string | null;
    subjectChanged: boolean;
    classId?: string | null;
    classChanged: boolean;
  }>;
  revertToMaster: AsyncAction<{ weekday: number; period: number }>;
}

/** 週次時間割のマス編集モーダル。開くたびに呼び出し側で再マウントされ、propsから一度だけ下書きを初期化する */
export function SlotEditModal({
  weekday,
  period,
  dateISO,
  initialSubjectId,
  initialClassId,
  isOverridden,
  subjects,
  classes,
  onClose,
  saveOverride,
  revertToMaster,
}: SlotEditModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);

  const subjectOptions = [
    { value: "", label: "未設定" },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];
  const classOptions = [
    { value: "", label: "未設定" },
    ...classes.map((c) => ({ value: c.id, label: c.displayName })),
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveOverride.mutateAsync({
        weekday,
        period,
        subjectId: subjectId || null,
        subjectChanged: (subjectId || null) !== initialSubjectId,
        classId: classId || null,
        classChanged: classId !== "" && classId !== initialClassId,
      });
      showToast("success", "個別変更を保存しました");
      onClose();
    } catch {
      showToast("error", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    try {
      await revertToMaster.mutateAsync({ weekday, period });
      showToast("success", "マスタの内容に戻しました");
      onClose();
    } catch {
      showToast("error", "元に戻す処理に失敗しました");
    } finally {
      setReverting(false);
    }
  };

  const handleRecord = () => {
    router.push(`/memos/record?date=${dateISO}&period=${period}`);
  };

  return (
    <Modal title={`${WEEKDAY_LABELS[weekday - 1]}曜${period}限`} open onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Select label="科目" options={subjectOptions} value={subjectId} onChange={setSubjectId} />
        <Select
          label="クラス"
          options={classOptions}
          value={classId}
          onChange={setClassId}
          emptyMessage="先にクラス管理画面でクラスを登録してください"
        />
        {classId === "" && initialClassId !== null && (
          <InlineMessage
            variant="info"
            message="クラスの個別変更を「未設定」として保存することはできません。マスタの内容に戻す場合は下のボタンをご利用ください"
          />
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {isOverridden && (
            <Button variant="outline" loading={reverting} onClick={handleRevert}>
              マスタの内容に戻す
            </Button>
          )}
          <Button variant="secondary" onClick={handleRecord}>
            この授業を記録する
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  );
}
