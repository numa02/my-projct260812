"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "error";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  showToast: (variant: ToastVariant, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-gray-900 text-gray-50",
  error: "bg-error-500 text-gray-50",
};

const VARIANT_ICON: Record<ToastVariant, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleX,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (variant: ToastVariant, message: string, duration = DEFAULT_DURATION_MS) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
          >
            {toasts.map((toast) => {
              const Icon = VARIANT_ICON[toast.variant];
              return (
                <div
                  key={toast.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-3 text-sm shadow-md",
                    VARIANT_CLASSES[toast.variant],
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {toast.message}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
