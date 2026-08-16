import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

export interface CardListProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  renderItem: (row: T) => ReactNode;
  loading?: boolean;
  emptyState?: ReactNode;
}

/** タブレット向けのカードリスト形式一覧(Tableと同じデータをカード化したもの) */
export function CardList<T>({ rows, rowKey, renderItem, loading, emptyState }: CardListProps<T>) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={rowKey(row)}>{renderItem(row)}</div>
      ))}
    </div>
  );
}
