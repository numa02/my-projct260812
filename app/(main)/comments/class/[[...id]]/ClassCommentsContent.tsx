"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClassOptions } from "@/hooks/useClassOptions";
import { useClassCommentPeriod } from "@/hooks/useClassCommentPeriod";
import { StudentCommentRow } from "@/components/comment/StudentCommentRow";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { computePseudonymCode } from "@/shared/pseudonym";
import type { CommentKind } from "@/shared/schemas";

export interface ClassCommentsContentProps {
  initialClassId: string | null;
  highlightStudentId: string | null;
}

export function ClassCommentsContent({ initialClassId, highlightStudentId }: ClassCommentsContentProps) {
  const router = useRouter();
  const { classes, isLoadingClasses, selectedClassId, setSelectedClassId, students, isLoadingStudents } =
    useClassOptions(initialClassId);
  // 生徒一覧の表示可否・AI生成の集計範囲は、入力中の未確定値ではなく
  // サーバー確認済みの対象期間を基準にする
  const { periodStartDate, periodEndDate } = useClassCommentPeriod(selectedClassId);
  // 対象期間は学習・生活の両タブで共通(クラスごとに1つ)
  const [kind, setKind] = useState<CommentKind>("learning");

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const hasPeriod = periodStartDate !== "" && periodEndDate !== "";
  const periodKey = `${periodStartDate}|${periodEndDate}`;

  if (!isLoadingClasses && classes.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">所見管理</h1>
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
      <h1 className="text-2xl font-semibold text-gray-900">所見管理</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="クラス"
            options={classes.map((c) => ({ value: c.id, label: c.displayName }))}
            value={selectedClassId ?? ""}
            onChange={setSelectedClassId}
          />
        </div>
        {selectedClassId && (
          // classIdが切り替わるたびにキーを変えて再マウントし、入力欄のローカルstateを
          // 前クラスの値を引きずらないよう確実にリセットする
          <CommentPeriodInputs key={selectedClassId} classId={selectedClassId} />
        )}
      </div>

      <SegmentedControl
        aria-label="所見の種類"
        options={[
          { value: "learning", label: "学習の所見" },
          { value: "life", label: "生活の所見" },
        ]}
        value={kind}
        onChange={(v) => setKind(v as CommentKind)}
      />

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
              // クラスIDを含めることで、クラス切り替え時に行を再マウントし、
              // 学年欄・所見入力欄に前のクラスの値が残らないようにする
              key={`${kind}-${selectedClass?.id ?? "none"}-${s.id}-${periodKey}`}
              studentId={s.id}
              kind={kind}
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
              classGrade={selectedClass?.grade ?? ""}
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

interface CommentPeriodInputsProps {
  classId: string;
}

/**
 * 対象期間(開始日・終了日)の入力欄。classIdごとにキーを変えて再マウントされる前提で、
 * ローカルstateはこのクラス専用として扱ってよい(前クラスの値の混入を心配しなくてよい)
 */
function CommentPeriodInputs({ classId }: CommentPeriodInputsProps) {
  const { showToast } = useToast();
  const {
    periodStartDate: confirmedStart,
    periodEndDate: confirmedEnd,
    updatePeriod,
    isLoading: isLoadingPeriod,
  } = useClassCommentPeriod(classId);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  // 開始日・終了日の表示値。教員の入力自体は(サーバーへの保存が完了する前でも)即座に反映する
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  // 保存時に「変更していない方のフィールド」の値を読むためのref。Reactのstate更新は
  // 非同期のため、開始日・終了日を連続して素早く変更すると、2回目のonChangeハンドラが
  // 1回目の変更によるstate更新をまだ反映していない古いクロージャで実行される恐れがある
  // (2つの変更の間で再レンダリングが挟まる保証がないため)。refへの代入は同期的かつ
  // 即座に反映されるため、この順序に依存しない
  const startRef = useRef("");
  const endRef = useRef("");
  // このクラスの確定値をローカルstate・refに一度だけ取り込み済みかどうか
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (hasSeededRef.current || isLoadingPeriod) return;
    hasSeededRef.current = true;
    startRef.current = confirmedStart;
    endRef.current = confirmedEnd;
    setPeriodStartDate(confirmedStart);
    setPeriodEndDate(confirmedEnd);
  }, [isLoadingPeriod, confirmedStart, confirmedEnd]);

  const savePeriod = (nextStart: string, nextEnd: string) => {
    if (nextStart && nextEnd && nextStart > nextEnd) {
      setEndDateError("開始日は終了日より前の日付にしてください");
      return;
    }
    setEndDateError(null);
    updatePeriod.mutate(
      { periodStartDate: nextStart, periodEndDate: nextEnd },
      {
        onError: () => {
          showToast("error", "対象期間の保存に失敗しました");
          startRef.current = confirmedStart;
          endRef.current = confirmedEnd;
          setPeriodStartDate(confirmedStart);
          setPeriodEndDate(confirmedEnd);
        },
      },
    );
  };

  const handleStartChange = (value: string) => {
    startRef.current = value;
    setPeriodStartDate(value);
    savePeriod(value, endRef.current);
  };

  const handleEndChange = (value: string) => {
    endRef.current = value;
    setPeriodEndDate(value);
    savePeriod(startRef.current, value);
  };

  return (
    <>
      <Input
        label="開始日"
        type="date"
        value={periodStartDate}
        onChange={(e) => handleStartChange(e.target.value)}
        disabled={isLoadingPeriod}
      />
      <Input
        label="終了日"
        type="date"
        value={periodEndDate}
        onChange={(e) => handleEndChange(e.target.value)}
        error={endDateError ?? undefined}
        disabled={isLoadingPeriod}
      />
    </>
  );
}
