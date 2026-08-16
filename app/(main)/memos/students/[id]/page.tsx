import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StudentMemosView } from "./StudentMemosView";

export default function StudentMemosPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="読み込み中..." />}>
      <StudentMemosView />
    </Suspense>
  );
}
