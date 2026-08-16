import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type InlineMessageVariant = "info" | "warning";

const VARIANT_CLASSES: Record<InlineMessageVariant, string> = {
  info: "bg-gray-100 text-gray-700",
  warning: "bg-warning-500/10 text-warning-500",
};

const VARIANT_ICON: Record<InlineMessageVariant, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
};

export interface InlineMessageProps {
  variant: InlineMessageVariant;
  message: string;
  className?: string;
}

/** 常時表示の注意文・警告文。トーストと異なり自動では消えない */
export function InlineMessage({ variant, message, className }: InlineMessageProps) {
  const Icon = VARIANT_ICON[variant];
  return (
    <div
      role={variant === "warning" ? "alert" : "note"}
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-normal",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
