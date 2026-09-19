import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LifeRecordView } from "./LifeRecordView";

export default function LifeRecordPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="読み込み中..." />}>
      <LifeRecordView />
    </Suspense>
  );
}
