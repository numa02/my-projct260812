"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  open: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "normal" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 削除・上書き・学年変更等のYes/No判断を伴う確認ダイアログ */
export function ConfirmDialog({
  title,
  body,
  open,
  confirmLabel = "続行",
  cancelLabel = "キャンセル",
  variant = "normal",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} open={open} onClose={onCancel}>
      <div className="text-sm leading-normal text-gray-700">{body}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
