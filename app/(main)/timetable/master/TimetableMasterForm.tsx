"use client";

import { useState } from "react";
import type { MasterSlotState } from "@/hooks/useTimetableMaster";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { parseRpcError } from "@/lib/rpc-error";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

type Mode = "bulk" | "per-class";

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface TimetableMasterFormProps {
  initialSlots: MasterSlotState[];
  initialStartDate: string | null;
  hasAnyMemo: boolean;
  saveMaster: AsyncAction<{ slots: MasterSlotState[]; confirmOverwrite: boolean }>;
  updateStartDate: AsyncAction<{ newStartDate: string; force: boolean }>;
}

/** 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される) */
export function TimetableMasterForm({
  initialSlots,
  initialStartDate,
  hasAnyMemo,
  saveMaster,
  updateStartDate,
}: TimetableMasterFormProps) {
  const { classes } = useClasses();
  const { subjects } = useSubjects();
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>("bulk");
  const [draftSlots, setDraftSlots] = useState<MasterSlotState[]>(initialSlots);
  // 未選択の場合、既存データがあればそのクラス、なければ一覧の先頭を既定選択とする。
  // <select>は空文字の選択肢がないと表示上は先頭を選択済みにしてしまうため、実際の状態もそれに合わせる
  // (常にstateから直接計算することで、classesの読み込みタイミングに関わらず正しい値になる)
  const [bulkClassIdOverride, setBulkClassIdOverride] = useState<string | null>(null);
  const inferredBulkClassId = draftSlots.find((s) => s.classId)?.classId ?? null;
  const bulkClassId = bulkClassIdOverride ?? inferredBulkClassId ?? classes[0]?.id ?? "";
  const setBulkClassId = setBulkClassIdOverride;
  const [startDateInput, setStartDateInput] = useState<string>(initialStartDate ?? "");
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [yearUpdateMode, setYearUpdateMode] = useState(false);
  const [yearUpdateConfirmOpen, setYearUpdateConfirmOpen] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isStartDateEditable = !hasAnyMemo || yearUpdateMode;

  const updateSlot = (weekday: number, period: number, patch: Partial<MasterSlotState>) => {
    setDraftSlots((prev) =>
      prev.map((s) => (s.weekday === weekday && s.period === period ? { ...s, ...patch } : s)),
    );
  };

  const slotAt = (weekday: number, period: number) =>
    draftSlots.find((s) => s.weekday === weekday && s.period === period)!;

  const buildPayload = (): MasterSlotState[] =>
    draftSlots.map((s) => ({
      ...s,
      classId: mode === "bulk" ? bulkClassId || null : s.classId,
    }));

  const doSave = async (confirmOverwrite: boolean) => {
    if (startDateInput.trim().length === 0) {
      setStartDateError("起算日を入力してください");
      return;
    }
    setStartDateError(null);
    setSaving(true);
    try {
      const payload = buildPayload();
      await saveMaster.mutateAsync({ slots: payload, confirmOverwrite });
      // 一括モードのclassId上書きはdraftSlots自体には反映されていないため、保存成功時に同期する
      // (教科担任制モードに切り替えて確認した際に古い値が見えてしまうのを防ぐ)
      setDraftSlots(payload);

      if (isStartDateEditable && startDateInput !== initialStartDate) {
        await updateStartDate.mutateAsync({
          newStartDate: startDateInput,
          force: yearUpdateMode,
        });
        setYearUpdateMode(false);
      }

      showToast("success", "時間割マスタを保存しました");
      setOverwriteConfirmOpen(false);
    } catch (err) {
      const { code, message } = parseRpcError(err as Error);
      if (code === "CONFIRM_OVERWRITE") {
        setOverwriteConfirmOpen(true);
      } else {
        showToast("error", message || "保存に失敗しました");
        setOverwriteConfirmOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const subjectOptions = [
    { value: "", label: "未設定" },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];
  const classOptions = [
    { value: "", label: "未設定" },
    ...classes.map((c) => ({ value: c.id, label: c.displayName })),
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">時間割マスタ設定</h1>

      <SegmentedControl
        aria-label="時間割入力モード"
        options={[
          { value: "bulk", label: "一括モード" },
          { value: "per-class", label: "教科担任制モード" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />

      {subjects.length === 0 && (
        <InlineMessage
          variant="warning"
          message="科目が登録されていません。先に科目管理画面で科目を登録してください"
        />
      )}

      {mode === "bulk" && (
        <div className="w-64">
          <Select
            label="クラス(全マスに適用)"
            options={classOptions.filter((o) => o.value !== "")}
            value={bulkClassId}
            onChange={setBulkClassId}
            emptyMessage="先にクラス管理画面でクラスを登録してください"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-12 border border-gray-200 bg-gray-50" />
              {WEEKDAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="border border-gray-200 bg-gray-50 px-2 py-2 text-center font-medium text-gray-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <td className="border border-gray-200 bg-gray-50 text-center text-gray-500">
                  {period}
                </td>
                {WEEKDAY_LABELS.map((_, index) => {
                  const weekday = index + 1;
                  const slot = slotAt(weekday, period);
                  return (
                    <td key={weekday} className="border border-gray-200 p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <select
                          aria-label={`${WEEKDAY_LABELS[index]}曜${period}限の科目`}
                          value={slot.subjectId ?? ""}
                          onChange={(e) =>
                            updateSlot(weekday, period, { subjectId: e.target.value || null })
                          }
                          className="rounded-sm border border-gray-300 px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                          {subjectOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {mode === "per-class" && (
                          <select
                            aria-label={`${WEEKDAY_LABELS[index]}曜${period}限のクラス`}
                            value={slot.classId ?? ""}
                            onChange={(e) =>
                              updateSlot(weekday, period, { classId: e.target.value || null })
                            }
                            className="rounded-sm border border-gray-300 px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                          >
                            {classOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex max-w-xs flex-col gap-2">
        <Input
          label="起算日"
          type="date"
          value={startDateInput}
          onChange={(e) => setStartDateInput(e.target.value)}
          disabled={!isStartDateEditable}
          error={startDateError ?? undefined}
        />
        {!isStartDateEditable && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-500">
              授業記録が開始されているため起算日は変更できません
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setYearUpdateConfirmOpen(true)}
            >
              年度を更新する
            </Button>
          </div>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="self-start"
        loading={saving}
        onClick={() => doSave(false)}
      >
        保存
      </Button>

      <ConfirmDialog
        title="マスごとのクラス設定を統一しますか"
        body="保存すると、マスごとに設定されているクラスがすべて選択したクラスに統一されます。続行しますか。"
        open={overwriteConfirmOpen}
        loading={saving}
        onConfirm={() => doSave(true)}
        onCancel={() => setOverwriteConfirmOpen(false)}
      />

      <ConfirmDialog
        title="年度を更新しますか"
        body="年度を更新すると、今日以降の週番号の数え方が新しい起算日を基準に変わります。過去に記録した授業記録・メモ・所感はそのまま残り、削除されません。"
        open={yearUpdateConfirmOpen}
        onConfirm={() => {
          setYearUpdateMode(true);
          setYearUpdateConfirmOpen(false);
        }}
        onCancel={() => setYearUpdateConfirmOpen(false)}
      />
    </div>
  );
}
