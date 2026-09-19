import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardProps {
  title: string;
  meta?: ReactNode;
  body: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** メモカード・所見カード共通。craft.do路線に沿いshadow-sm + radius-mdの柔らかい表現を使う */
export function Card({ title, meta, body, selected, onClick, className }: CardProps) {
  const clickable = Boolean(onClick);
  const Component = clickable ? "button" : "div";

  return (
    <Component
      type={clickable ? "button" : undefined}
      onClick={onClick}
      aria-pressed={clickable ? selected : undefined}
      className={cn(
        "flex w-full flex-col gap-2 rounded-md border bg-white p-4 text-left shadow-sm transition-colors",
        clickable && "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400",
        selected ? "border-gray-900" : "border-gray-200",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {meta && <div className="text-xs text-gray-500">{meta}</div>}
      </div>
      <div className="text-sm leading-normal text-gray-700">{body}</div>
    </Component>
  );
}
