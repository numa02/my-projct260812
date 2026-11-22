"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { AI_MODEL, type AiProvider } from "@/shared/ai-models";
import type { AiProviderSettingData } from "@/hooks/useAiProviderSettings";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
];

interface AsyncAction<T> {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
}

export interface AiProviderSettingsFormProps {
  initialSetting: AiProviderSettingData;
  saveSetting: AsyncAction<{ provider: AiProvider; apiKey: string }>;
}

/** 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される) */
export function AiProviderSettingsForm({ initialSetting, saveSetting }: AiProviderSettingsFormProps) {
  const { showToast } = useToast();

  const [provider, setProvider] = useState<AiProvider>(initialSetting.provider ?? "openai");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initialSetting.hasKey);
  // プルダウンの選択値は「保存済みの値」と「教員が選び直しただけの未保存の値」を区別できないため、
  // 登録済みの内容を別に保持して設定状況の横に併記する(docs/features/ui-clarity/)。
  // モデルは教員が選ばず、プロバイダごとの固定モデルを併記する(docs/features/ai-model-fixed/)
  const [savedProvider, setSavedProvider] = useState(initialSetting.provider);

  const handleSave = async () => {
    if (apiKey.trim().length === 0) return;
    try {
      await saveSetting.mutateAsync({ provider, apiKey: apiKey.trim() });
      setApiKey("");
      setHasKey(true);
      setSavedProvider(provider);
      showToast("success", "AIプロバイダ設定を保存しました");
    } catch (err) {
      showToast("error", (err as Error).message || "保存に失敗しました");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">AIプロバイダ設定</h1>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">APIキー</span>
        {hasKey ? (
          <Badge variant="recorded" label="設定済み" />
        ) : (
          <Badge variant="neutral" label="未設定" />
        )}
        {hasKey && savedProvider && (
          <span className="text-sm text-gray-600">
            {PROVIDER_OPTIONS.find((o) => o.value === savedProvider)?.label ?? savedProvider} /{" "}
            {AI_MODEL[savedProvider]}
          </span>
        )}
      </div>

      <div className="flex max-w-md flex-col gap-4">
        <Select
          label="AIプロバイダ"
          options={PROVIDER_OPTIONS}
          value={provider}
          onChange={(value) => setProvider(value as AiProvider)}
        />
        <Input
          label="APIキー"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? "変更する場合のみ入力してください" : "APIキーを入力してください"}
        />

        <InlineMessage
          variant="info"
          message="APIキーはサーバー側で暗号化して保存されます。保存後は画面に再表示されません。定期的なキーの見直し・失効を推奨します"
        />

        <Button
          variant="primary"
          size="lg"
          className="self-start"
          loading={saveSetting.isPending}
          disabled={apiKey.trim().length === 0}
          onClick={handleSave}
        >
          保存
        </Button>
      </div>
    </div>
  );
}
