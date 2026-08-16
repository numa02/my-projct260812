"use client";

import { useRouter } from "next/navigation";
import { useTeacherProfile } from "@/hooks/useTeacherProfile";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeeklyTimetableView } from "./WeeklyTimetableView";

export default function WeeklyTimetablePage() {
  const router = useRouter();
  const { startDate, isLoading } = useTeacherProfile();

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  if (!startDate) {
    return (
      <div className="p-8">
        <EmptyState
          message="起算日が未設定のため週次時間割を表示できません。先に時間割マスタ設定画面で起算日を設定してください"
          actionLabel="時間割マスタ設定画面へ"
          onAction={() => router.push("/timetable/master")}
        />
      </div>
    );
  }

  return <WeeklyTimetableView startDate={startDate} />;
}
