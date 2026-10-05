"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemoRecord } from "@/hooks/useMemoRecord";
import { useUnits } from "@/hooks/useUnits";
import { StudentMemoRow } from "@/components/memo/StudentMemoRow";
import { CollapsibleList } from "@/components/ui/CollapsibleList";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { computePseudonymCode } from "@/shared/pseudonym";
import { getTodayISO } from "@/shared/week";

const PERIODS = [1, 2, 3, 4, 5, 6];

/** 単元を選んでいない状態を<select>で表す値 */
const UNIT_UNSELECTED = "";

export function RecordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const from = searchParams.get("from");

  const [dateISO, setDateISO] = useState(() => searchParams.get("date") ?? getTodayISO());
  const [period, setPeriod] = useState(() => {
    const p = Number(searchParams.get("period"));
    return PERIODS.includes(p) ? p : 1;
  });
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const {
    isLoading,
    isLoadingMemos,
    classInfo,
    subjectId,
    subjectName,
    students,
    existingMemos,
    slotUnitId,
    isSlotUnitResolved,
    saveMemo,
    updateSlotUnit,
  } = useMemoRecord(dateISO, period);

  const { units, isLoading: isLoadingUnits } = useUnits(subjectId);

  // 単元の表示値。教員の選択はサーバーへの保存完了前でも即座に反映する(表示の先取りではなく、
  // 操作に対する応答。保存に失敗したらサーバー確定値に戻す)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(UNIT_UNSELECTED);
  // このコマの確定値を表示値へ取り込み済みかどうか。コマが変わるたびに作り直す
  const slotKey = `${dateISO}|${period}|${subjectId ?? "none"}`;
  const seededSlotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSlotUnitResolved || seededSlotKeyRef.current === slotKey) return;
    seededSlotKeyRef.current = slotKey;
    setSelectedUnitId(slotUnitId ?? UNIT_UNSELECTED);
  }, [isSlotUnitResolved, slotKey, slotUnitId]);

  const handleUnitChange = (value: string) => {
    const previous = selectedUnitId;
    setSelectedUnitId(value);
    updateSlotUnit.mutate(value === UNIT_UNSELECTED ? null : value, {
      // 保存済みメモの単元を書き換えたときだけ通知する(0件なら保存されたものはない)
      onSuccess: (updatedCount) => {
        if (updatedCount > 0) {
          showToast("success", `このコマの${updatedCount}件のメモの単元を更新しました`);
        }
      },
      onError: () => {
        showToast("error", "単元の変更に失敗しました");
        setSelectedUnitId(previous);
      },
    });
  };

  // 単元はコマごとに1つのため、行ごとのメモ保存にはこの画面で選択中の単元を添える。
  // StudentMemoRowは生活記録画面とも共有しているため、行側の入力項目は増やさない
  const saveMemoWithUnit = useMemo(
    () => ({
      mutateAsync: (input: { studentId: string; content: string; shareFlag: "shared" | "private" }) =>
        saveMemo.mutateAsync({
          ...input,
          unitId: selectedUnitId === UNIT_UNSELECTED ? null : selectedUnitId,
        }),
      isPending: saveMemo.isPending,
    }),
    [saveMemo, selectedUnitId],
  );

  const memoByStudentId = new Map(existingMemos.map((m) => [m.studentId, m]));
  const canRecord = classInfo !== null && subjectName !== null;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">授業記録</h1>
        {from && (
          <Button variant="outline" size="sm" onClick={() => router.push(from)}>
            戻る
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          日付
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="rounded-sm border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          時限
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-sm border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}限
              </option>
            ))}
          </select>
        </label>

        {canRecord && (
          <p className="text-base text-gray-700">
            {subjectName} / {classInfo.displayName}
          </p>
        )}

        {canRecord && (
          <div className="w-64">
            <Select
              label="単元"
              // 単元が0件のときはemptyMessageを出させるため、選択肢自体を空にする
              options={
                units.length === 0
                  ? []
                  : [
                      { value: UNIT_UNSELECTED, label: "選択しない" },
                      ...units.map((u) => ({ value: u.id, label: u.name })),
                    ]
              }
              value={selectedUnitId}
              onChange={handleUnitChange}
              // 初期選択が確定する前に教員が操作すると、直後の初期化で選択が上書きされてしまう
              disabled={isLoadingUnits || !isSlotUnitResolved || updateSlotUnit.isPending}
              emptyMessage={
                isLoadingUnits
                  ? "読み込み中..."
                  : "まだ単元が登録されていません(科目管理画面で登録できます)"
              }
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner label="読み込み中..." />
      ) : !canRecord ? (
        <EmptyState message="この時間には科目またはクラスが設定されていないため、記録できません" />
      ) : students.length === 0 ? (
        <EmptyState message="まだ生徒が登録されていません" />
      ) : (
        <CollapsibleList
          rows={students}
          rowKey={(s) => s.id}
          loading={isLoadingMemos}
          expandedRowId={expandedStudentId}
          onToggleRow={(id) => setExpandedStudentId((prev) => (prev === id ? null : id))}
          renderSummary={(s) => {
            const memo = memoByStudentId.get(s.id);
            return (
              <span className="flex items-center gap-2">
                {s.name}
                {classInfo && (
                  <CodeBadge
                    code={computePseudonymCode({
                      grade: classInfo.grade,
                      groupNumber: classInfo.groupNumber,
                      attendanceNumber: s.attendanceNumber,
                    })}
                  />
                )}
                {memo && <Badge variant="recorded" label="入力済み" />}
              </span>
            );
          }}
          renderExpanded={(s) => {
            const memo = memoByStudentId.get(s.id);
            return (
              <StudentMemoRow
                key={s.id}
                studentId={s.id}
                initialContent={memo?.content ?? ""}
                initialShareFlag={memo?.shareFlag ?? "shared"}
                saveMemo={saveMemoWithUnit}
              />
            );
          }}
        />
      )}
    </div>
  );
}
