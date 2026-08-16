import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
}

/** 通常セレクト。選択肢が0件の場合はemptyMessageを表示し無効化する */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, value, onChange, disabled, emptyMessage, className },
  ref,
) {
  const generatedId = useId();
  const isEmpty = options.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={generatedId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {isEmpty ? (
        <p className="text-sm text-gray-500">{emptyMessage ?? "選択できる項目がありません"}</p>
      ) : (
        <select
          ref={ref}
          id={generatedId}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-base text-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-gray-400",
            "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
            className,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
});
