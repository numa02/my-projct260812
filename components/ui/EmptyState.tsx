import { Button } from "./Button";

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 案内文のみ、または案内文+主要導線ボタン付きの空状態表示 */
export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md bg-gray-50 px-6 py-12 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
