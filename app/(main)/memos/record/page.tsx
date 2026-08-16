import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RecordView } from "./RecordView";

export default function RecordPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="読み込み中..." />}>
      <RecordView />
    </Suspense>
  );
}
