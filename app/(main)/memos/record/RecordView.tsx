"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemoRecord } from "@/hooks/useMemoRecord";
import { StudentMemoRow } from "@/components/memo/StudentMemoRow";
import { CollapsibleList } from "@/components/ui/CollapsibleList";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { computePseudonymCode } from "@/shared/pseudonym";
import { getTodayISO } from "@/shared/week";

const PERIODS = [1, 2, 3, 4, 5, 6];

export function RecordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [dateISO, setDateISO] = useState(() => searchParams.get("date") ?? getTodayISO());
  const [period, setPeriod] = useState(() => {
    const p = Number(searchParams.get("period"));
    return PERIODS.includes(p) ? p : 1;
  });
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const { isLoading, isLoadingMemos, classInfo, subjectName, students, existingMemos, saveMemo } =
    useMemoRecord(dateISO, period);

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
                saveMemo={saveMemo}
              />
            );
          }}
        />
      )}
    </div>
  );
}
