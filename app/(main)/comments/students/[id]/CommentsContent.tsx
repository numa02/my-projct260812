"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClassOptions } from "@/hooks/useClassOptions";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "generate" | "history";

export interface CommentsContentProps {
  initialClassId: string | null;
  initialStudentId: string | null;
}

export function CommentsContent({ initialClassId, initialStudentId }: CommentsContentProps) {
  const router = useRouter();
  const { classes, isLoadingClasses, selectedClassId, setSelectedClassId, students } =
    useClassOptions(initialClassId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId);
  const [tab, setTab] = useState<Tab>("generate");

  if (!isLoadingClasses && classes.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">所感</h1>
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
      <h1 className="text-2xl font-semibold text-gray-900">所感</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="クラス"
            options={classes.map((c) => ({ value: c.id, label: c.displayName }))}
            value={selectedClassId ?? ""}
            onChange={(id) => {
              setSelectedClassId(id);
              setSelectedStudentId(null);
            }}
          />
        </div>
        {selectedClassId && (
          <div className="w-64">
            <Select
              label="生徒"
              options={students.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedStudentId ?? ""}
              onChange={setSelectedStudentId}
              emptyMessage="このクラスにはまだ生徒が登録されていません"
            />
          </div>
        )}
      </div>

      {selectedStudentId && (
        <SegmentedControl
          aria-label="タブ切替"
          options={[
            { value: "generate", label: "生成" },
            { value: "history", label: "履歴" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      )}

      {!selectedClassId ? null : !selectedStudentId ? (
        <EmptyState message="生徒を選択してください" />
      ) : tab === "generate" ? (
        <EmptyState message="所感の生成機能は準備中です" />
      ) : (
        <EmptyState message="所感の履歴機能は準備中です" />
      )}
    </div>
  );
}
