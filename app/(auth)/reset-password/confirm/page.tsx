import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ResetPasswordConfirmForm } from "./ResetPasswordConfirmForm";

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="読み込み中..." />}>
      <ResetPasswordConfirmForm />
    </Suspense>
  );
}
