"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useWeeklyTimetable } from "@/hooks/useWeeklyTimetable";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { TimetableGrid, type TimetableCell } from "@/components/timetable/TimetableGrid";
import { SlotEditModal } from "@/components/timetable/SlotEditModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { addWeekdayOffset, formatISODate, getWeekStartDate } from "@/shared/week";

interface EditingSlot {
  weekday: number;
  period: number;
}

function parseJstDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00+09:00`);
}

export function WeeklyTimetableView() {
  const [weekStartDateISO, setWeekStartDateISO] = useState(() =>
    formatISODate(getWeekStartDate(new Date())),
  );
  const [editingSlot, setEditingSlot] = useState<EditingSlot | null>(null);

  const { classes } = useClasses();
  const { subjects } = useSubjects();
  const { resolvedSlots, isLoading, saveOverride, revertToMaster } =
    useWeeklyTimetable(weekStartDateISO);

  const weekStartDate = useMemo(() => parseJstDate(weekStartDateISO), [weekStartDateISO]);
  const weekEndDate = useMemo(() => addWeekdayOffset(weekStartDate, 5), [weekStartDate]);

  const goToPrevWeek = () => setWeekStartDateISO(formatISODate(addDays(weekStartDate, -7)));
  const goToNextWeek = () => setWeekStartDateISO(formatISODate(addDays(weekStartDate, 7)));
  const goToToday = () => setWeekStartDateISO(formatISODate(getWeekStartDate(new Date())));
  const goToDate = (dateISO: string) => {
    if (!dateISO) return;
    setWeekStartDateISO(formatISODate(getWeekStartDate(parseJstDate(dateISO))));
  };

  const subjectLabel = (id: string | null) =>
    id ? (subjects.find((s) => s.id === id)?.name ?? null) : null;
  const classLabel = (id: string | null) =>
    id ? (classes.find((c) => c.id === id)?.displayName ?? null) : null;

  const cells: TimetableCell[] = resolvedSlots.map((s) => ({
    weekday: s.weekday,
    period: s.period,
    subjectLabel: subjectLabel(s.subjectId),
    classLabel: classLabel(s.classId),
    changed: s.isSubjectOverridden || s.isClassOverridden,
  }));

  const editingResolvedSlot = editingSlot
    ? (resolvedSlots.find(
        (s) => s.weekday === editingSlot.weekday && s.period === editingSlot.period,
      ) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">週次時間割</h1>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="前の週へ"
            onClick={goToPrevWeek}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="次の週へ"
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            今週
          </Button>
        </div>

        <p className="text-base font-medium text-gray-900">
          {format(weekStartDate, "yyyy年M月d日")}(月)〜
          {format(weekEndDate, "M月d日")}(金)
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          週を指定
          <input
            type="date"
            value={weekStartDateISO}
            onChange={(e) => goToDate(e.target.value)}
            className="rounded-sm border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </label>
      </div>

      {isLoading ? (
        <LoadingSpinner label="読み込み中..." />
      ) : (
        <TimetableGrid
          mode="weekly"
          cells={cells}
          onCellClick={(cell) => setEditingSlot({ weekday: cell.weekday, period: cell.period })}
        />
      )}

      {editingSlot && editingResolvedSlot && (
        <SlotEditModal
          key={`${editingSlot.weekday}-${editingSlot.period}-${weekStartDateISO}`}
          weekday={editingSlot.weekday}
          period={editingSlot.period}
          dateISO={formatISODate(addWeekdayOffset(weekStartDate, editingSlot.weekday))}
          initialSubjectId={editingResolvedSlot.subjectId}
          initialClassId={editingResolvedSlot.classId}
          isOverridden={editingResolvedSlot.isSubjectOverridden || editingResolvedSlot.isClassOverridden}
          subjects={subjects}
          classes={classes}
          onClose={() => setEditingSlot(null)}
          saveOverride={saveOverride}
          revertToMaster={revertToMaster}
        />
      )}
    </div>
  );
}
