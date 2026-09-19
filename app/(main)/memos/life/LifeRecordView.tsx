"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLifeRecord } from "@/hooks/useLifeRecord";
import { StudentMemoRow } from "@/components/memo/StudentMemoRow";
import { CollapsibleList } from "@/components/ui/CollapsibleList";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { computePseudonymCode } from "@/shared/pseudonym";
import { getTodayISO } from "@/shared/week";

/**
 * 生活記録画面。授業に紐づかない生徒の様子を、日付ごとに1人1件記録する。
 * 対象クラスはその日の時間割から決まり、教科担任制などで1つに決まらない場合のみ選択欄を出す
 */
export function LifeRecordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [dateISO, setDateISO] = useState(() => searchParams.get("date") ?? getTodayISO());
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const {
    isLoading,
    isLoadingMemos,
    needsClassSelection,
    candidateClasses,
    classInfo,
    students,
    existingMemos,
    saveMemo,
  } = useLifeRecord(dateISO, selectedClassId);

  const memoByStudentId = new Map(existingMemos.map((m) => [m.studentId, m]));

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">生活記録</h1>
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
            onChange={(e) => {
              setDateISO(e.target.value);
              setExpandedStudentId(null);
            }}
            className="rounded-sm border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </label>

        {!isLoading && needsClassSelection && candidateClasses.length > 0 && (
          <div className="w-64">
            <Select
              label="クラス"
              options={candidateClasses.map((c) => ({ value: c.id, label: c.displayName }))}
              value={classInfo?.id ?? ""}
              onChange={(id) => {
                setSelectedClassId(id);
                setExpandedStudentId(null);
              }}
            />
          </div>
        )}

        {!isLoading && !needsClassSelection && classInfo && (
          <p className="text-base text-gray-700">{classInfo.displayName}</p>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner label="読み込み中..." />
      ) : !classInfo ? (
        <EmptyState
          message="まだクラスが登録されていません"
          actionLabel="クラス管理画面へ"
          onAction={() => router.push("/classes")}
        />
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
                <CodeBadge
                  code={computePseudonymCode({
                    grade: classInfo.grade,
                    groupNumber: classInfo.groupNumber,
                    attendanceNumber: s.attendanceNumber,
                  })}
                />
                {memo && <Badge variant="recorded" label="入力済み" />}
              </span>
            );
          }}
          renderExpanded={(s) => {
            const memo = memoByStudentId.get(s.id);
            return (
              <StudentMemoRow
                key={`${s.id}-${dateISO}`}
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
