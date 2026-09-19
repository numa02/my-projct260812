import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

export interface TimetableCell {
  weekday: number; // 1(月)〜5(金)
  period: number; // 1〜6
  subjectLabel: string | null; // null = 未設定(空きコマ)
  classLabel: string | null;
  /** 個別変更あり。週次時間割モードでのみ意味を持つ */
  changed?: boolean;
}

export type TimetableGridMode = "master" | "weekly";

export interface TimetableGridProps {
  mode: TimetableGridMode;
  cells: TimetableCell[];
  onCellClick?: (cell: TimetableCell) => void;
  /** 指定した場合のみ、6限の下に曜日ごとの「生活」行を表示する(週次時間割画面のみ) */
  onLifeCellClick?: (weekday: number) => void;
}

/**
 * 時間割マスタ設定画面・週次時間割画面で共通利用するグリッド。
 * 編集モードの切り替え自体(一括/教科担任制など)は呼び出し側の画面が担当する。
 */
export function TimetableGrid({ mode, cells, onCellClick, onLifeCellClick }: TimetableGridProps) {
  const cellAt = (weekday: number, period: number) =>
    cells.find((c) => c.weekday === weekday && c.period === period);

  return (
    <div
      role="grid"
      aria-label={mode === "master" ? "時間割マスタ" : "週次時間割"}
      className="grid grid-cols-[3rem_repeat(5,1fr)] gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 text-sm"
    >
      <div className="bg-gray-50" />
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          role="columnheader"
          className="bg-gray-50 px-2 py-2 text-center font-medium text-gray-600"
        >
          {label}
        </div>
      ))}

      {PERIODS.map((period) => (
        <Fragment key={period}>
          <div
            key={`period-${period}`}
            role="rowheader"
            className="flex items-center justify-center bg-gray-50 text-gray-500"
          >
            {period}
          </div>
          {WEEKDAY_LABELS.map((_, index) => {
            const weekday = index + 1;
            const cell = cellAt(weekday, period);
            const unset = !cell?.subjectLabel && !cell?.classLabel;
            const clickable = Boolean(onCellClick);
            const Component = clickable ? "button" : "div";

            return (
              <Component
                key={`${weekday}-${period}`}
                type={clickable ? "button" : undefined}
                role="gridcell"
                onClick={cell && onCellClick ? () => onCellClick(cell) : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-start justify-center gap-1 bg-white px-2 py-1.5 text-left",
                  clickable && "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400",
                  unset && "text-gray-400",
                )}
              >
                {unset ? (
                  <span>未設定</span>
                ) : (
                  <>
                    <span className="font-medium text-gray-900">{cell?.subjectLabel}</span>
                    {cell?.classLabel && (
                      <span className="text-xs text-gray-500">{cell.classLabel}</span>
                    )}
                    {mode === "weekly" && cell?.changed && (
                      <Badge variant="changed" label="変更あり" />
                    )}
                  </>
                )}
              </Component>
            );
          })}
        </Fragment>
      ))}

      {onLifeCellClick && (
        <>
          <div role="rowheader" className="flex items-center justify-center bg-gray-50 text-gray-500">
            生活
          </div>
          {WEEKDAY_LABELS.map((label, index) => (
            <button
              key={`life-${label}`}
              type="button"
              role="gridcell"
              aria-label={`${label}曜の生活記録`}
              onClick={() => onLifeCellClick(index + 1)}
              className="flex min-h-12 items-center bg-white px-2 py-1.5 text-left text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400"
            >
              生活記録
            </button>
          ))}
        </>
      )}
    </div>
  );
}
