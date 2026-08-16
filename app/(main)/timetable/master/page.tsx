"use client";

import { useTimetableMaster } from "@/hooks/useTimetableMaster";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TimetableMasterForm } from "./TimetableMasterForm";

export default function TimetableMasterPage() {
  const { slots, isLoading, startDate, hasAnyMemo, saveMaster, updateStartDate } =
    useTimetableMaster();

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <TimetableMasterForm
      initialSlots={slots}
      initialStartDate={startDate}
      hasAnyMemo={hasAnyMemo}
      saveMaster={saveMaster}
      updateStartDate={updateStartDate}
    />
  );
}
