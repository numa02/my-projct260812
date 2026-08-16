"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SUPPORTED_MODELS, DEFAULT_MODEL, type AiProvider } from "@/shared/ai-models";
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
  saveSetting: AsyncAction<{ provider: AiProvider; model: string; apiKey: string }>;
}

/** 下書きの初期値はpropsから一度だけ受け取る(サーバーデータのロード完了後にのみ親から描画される) */
export function AiProviderSettingsForm({ initialSetting, saveSetting }: AiProviderSettingsFormProps) {
  const { showToast } = useToast();

  const [provider, setProvider] = useState<AiProvider>(initialSetting.provider ?? "openai");
  const [model, setModel] = useState(initialSetting.model ?? DEFAULT_MODEL[initialSetting.provider ?? "openai"]);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initialSetting.hasKey);

  const handleProviderChange = (value: string) => {
    const nextProvider = value as AiProvider;
    setProvider(nextProvider);
    setModel(DEFAULT_MODEL[nextProvider]);
  };

  const handleSave = async () => {
    if (apiKey.trim().length === 0) return;
    try {
      await saveSetting.mutateAsync({ provider, model, apiKey: apiKey.trim() });
      setApiKey("");
      setHasKey(true);
      showToast("success", "AIプロバイダ設定を保存しました");
    } catch (err) {
      showToast("error", (err as Error).message || "保存に失敗しました");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">AIプロバイダ設定</h1>

      <div className="flex items-center gap-2">
        {hasKey ? (
          <Badge variant="neutral" label="設定済み" />
        ) : (
          <Badge variant="neutral" label="未設定" />
        )}
      </div>

      <div className="flex max-w-md flex-col gap-4">
        <Select
          label="AIプロバイダ"
          options={PROVIDER_OPTIONS}
          value={provider}
          onChange={handleProviderChange}
        />
        <Select
          label="モデル"
          options={SUPPORTED_MODELS[provider].map((m) => ({ value: m, label: m }))}
          value={model}
          onChange={setModel}
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
