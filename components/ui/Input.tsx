import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BaseProps = {
  label?: string;
  error?: string;
};

export type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    type?: "text" | "email" | "password" | "number" | "date";
  };

const fieldClasses = (hasError: boolean) =>
  cn(
    "w-full rounded-sm border bg-white px-3 py-2 text-base text-gray-700",
    "focus:outline-none focus:ring-2 focus:ring-gray-400",
    "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
    "placeholder:text-gray-400",
    hasError ? "border-error-500 focus:ring-error-500" : "border-gray-300",
  );

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, type = "text", className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={errorId}
        className={cn(fieldClasses(Boolean(error)), className)}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-error-500">
          {error}
        </p>
      )}
    </div>
  );
});

export type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** メモ・所感本文など複数行入力用 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={errorId}
        className={cn(fieldClasses(Boolean(error)), "leading-normal", className)}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-error-500">
          {error}
        </p>
      )}
    </div>
  );
});
