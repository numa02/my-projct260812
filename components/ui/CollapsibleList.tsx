import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export interface CollapsibleListProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  renderSummary: (row: T) => ReactNode;
  renderExpanded: (row: T) => ReactNode;
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
  loading?: boolean;
  emptyState?: ReactNode;
}

/**
 * 氏名など1行の要約のみを表示し、タップで行内に入力・操作エリアを展開するリスト(授業記録画面)。
 * 各行は独立して展開・保存でき、ある行の操作が他の行の状態に影響してはならない。
 */
export function CollapsibleList<T>({
  rows,
  rowKey,
  renderSummary,
  renderExpanded,
  expandedRowId,
  onToggleRow,
  loading,
  emptyState,
}: CollapsibleListProps<T>) {
  if (loading) {
    return (
      <div className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4">
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
      {rows.map((row) => {
        const id = rowKey(row);
        const expanded = expandedRowId === id;
        return (
          <div key={id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onToggleRow(id)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400"
            >
              <span className="text-sm font-medium text-gray-900">{renderSummary(row)}</span>
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")}
              />
            </button>
            {expanded && <div className="px-4 pb-4">{renderExpanded(row)}</div>}
          </div>
        );
      })}
    </div>
  );
}
