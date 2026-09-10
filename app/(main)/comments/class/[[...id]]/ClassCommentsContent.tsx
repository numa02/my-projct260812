"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClassOptions } from "@/hooks/useClassOptions";
import { useClassCommentPeriod } from "@/hooks/useClassCommentPeriod";
import { StudentCommentRow } from "@/components/comment/StudentCommentRow";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { computePseudonymCode } from "@/shared/pseudonym";

export interface ClassCommentsContentProps {
  initialClassId: string | null;
  highlightStudentId: string | null;
}

export function ClassCommentsContent({ initialClassId, highlightStudentId }: ClassCommentsContentProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { classes, isLoadingClasses, selectedClassId, setSelectedClassId, students, isLoadingStudents } =
    useClassOptions(initialClassId);
  const { periodStartDate, periodEndDate, updatePeriod } = useClassCommentPeriod(selectedClassId);
  const [endDateError, setEndDateError] = useState<string | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const hasPeriod = periodStartDate !== "" && periodEndDate !== "";
  const periodKey = `${periodStartDate}|${periodEndDate}`;

  const savePeriod = (nextStart: string, nextEnd: string) => {
    if (nextStart && nextEnd && nextStart > nextEnd) {
      setEndDateError("開始日は終了日より前の日付にしてください");
      return;
    }
    setEndDateError(null);
    updatePeriod.mutate(
      { periodStartDate: nextStart, periodEndDate: nextEnd },
      { onError: () => showToast("error", "対象期間の保存に失敗しました") },
    );
  };

  if (!isLoadingClasses && classes.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">所感管理</h1>
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
      <h1 className="text-2xl font-semibold text-gray-900">所感管理</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="クラス"
            options={classes.map((c) => ({ value: c.id, label: c.displayName }))}
            value={selectedClassId ?? ""}
            onChange={setSelectedClassId}
          />
        </div>
        <Input
          label="開始日"
          type="date"
          value={periodStartDate}
          onChange={(e) => savePeriod(e.target.value, periodEndDate)}
        />
        <Input
          label="終了日"
          type="date"
          value={periodEndDate}
          onChange={(e) => savePeriod(periodStartDate, e.target.value)}
          error={endDateError ?? undefined}
        />
      </div>

      {!hasPeriod ? (
        <InlineMessage
          variant="info"
          message="対象期間(開始日・終了日)を指定すると、このクラスの生徒一覧が表示されます"
        />
      ) : isLoadingStudents ? (
        <div className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState message="まだ生徒が登録されていません" />
      ) : (
        <div className="flex flex-col rounded-md border border-gray-200 px-4">
          {students.map((s) => (
            <StudentCommentRow
              key={`${s.id}-${periodKey}`}
              studentId={s.id}
              studentName={s.name}
              pseudonymCode={
                selectedClass
                  ? computePseudonymCode({
                      grade: selectedClass.grade,
                      groupNumber: selectedClass.groupNumber,
                      attendanceNumber: s.attendanceNumber,
                    })
                  : ""
              }
              periodStartDate={periodStartDate}
              periodEndDate={periodEndDate}
              highlighted={s.id === highlightStudentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
