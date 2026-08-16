import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/** 一覧・カードの読み込み中プレースホルダー */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-gray-200", className)}
      {...rest}
    />
  );
}

/** 表形式の行スケルトン。columnsは列数(幅の均等割り) */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3" role="presentation" aria-hidden>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}
