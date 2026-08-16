"use client";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AiProviderSettingsForm } from "./AiProviderSettingsForm";

export default function AiProviderSettingsPage() {
  const { setting, isLoading, saveSetting } = useAiProviderSettings();

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner label="読み込み中..." />
      </div>
    );
  }

  return <AiProviderSettingsForm initialSetting={setting} saveSetting={saveSetting} />;
}
