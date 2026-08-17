import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ClassCommentsView } from "./ClassCommentsView";

export default function ClassCommentsPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="読み込み中..." />}>
      <ClassCommentsView />
    </Suspense>
  );
}
