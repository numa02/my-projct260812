import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type LoadingSpinnerSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  label?: string;
  className?: string;
}

/** インラインスピナー。待機時間が長い処理はlabelで状況を示す */
export function LoadingSpinner({ size = "md", label, className }: LoadingSpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-gray-500", SIZE_CLASSES[size])} aria-hidden />
      {label ? (
        <span className="text-sm text-gray-600">{label}</span>
      ) : (
        <span className="sr-only">読み込み中</span>
      )}
    </span>
  );
}

/** AI生成待ちなど時間のかかる処理向けのフルスクリーンローディング */
export function FullScreenLoading({ label }: { label?: string }) {
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gray-50/90"
    >
      <Loader2 className="h-10 w-10 animate-spin text-gray-500" aria-hidden />
      <span className="text-sm text-gray-600">{label ?? "読み込み中"}</span>
    </div>
  );
}
