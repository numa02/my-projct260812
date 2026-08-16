import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "shared"
  | "private"
  | "direct_ai"
  | "prompt_copy"
  | "manual"
  | "changed"
  | "recorded"
  | "neutral";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  shared: "bg-success-500/10 text-success-500",
  private: "bg-gray-200 text-gray-700",
  direct_ai: "bg-gray-900/10 text-gray-900",
  prompt_copy: "bg-gray-200 text-gray-700",
  manual: "bg-gray-100 text-gray-600",
  changed: "bg-warning-500/10 text-warning-500",
  recorded: "bg-success-500/10 text-success-500",
  neutral: "bg-gray-100 text-gray-600",
};

export interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

/** 色分けのみに依存せず、必ずラベルテキストを併記する(アクセシビリティ方針) */
export function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {variant === "recorded" && (
        <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
      )}
      {label}
    </span>
  );
}
