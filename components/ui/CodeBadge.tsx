import { cn } from "@/lib/cn";

export interface CodeBadgeProps {
  code: string;
  className?: string;
}

/** 仮名コード表示。氏名に併記する小さいラベル */
export function CodeBadge({ code, className }: CodeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600",
        className,
      )}
    >
      {code}
    </span>
  );
}
