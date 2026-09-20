import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">生徒別メモ一覧</h1>
      <LoadingSpinner label="読み込み中..." />
    </div>
  );
}
