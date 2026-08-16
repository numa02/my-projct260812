import type { ReactNode } from "react";
import { SkeletonRow } from "./Skeleton";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: ReactNode;
}

/** デスクトップ向けの表形式一覧(クラス一覧、生徒一覧、科目一覧等) */
export function Table<T>({ columns, rows, rowKey, loading, emptyState }: TableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-md border border-gray-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} columns={columns.length} />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          {columns.map((column) => (
            <th key={column.key} className="px-4 py-2 font-medium">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-gray-100 text-gray-700">
            {columns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
