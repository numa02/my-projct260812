import { Hono } from "hono";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { aiProviderSettingInputSchema } from "@/shared/schemas";
import { isSupportedModel, type AiProvider } from "@/shared/ai-models";
import { encryptApiKey, decryptApiKey } from "../services/crypto";
import { aiAdapters, AiProviderError } from "../services/ai-adapters";

export const aiRoutes = new Hono();

async function getMasterKey(): Promise<string> {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ENCRYPTION_MASTER_KEY is not configured");
  }
  return masterKey;
}

aiRoutes.get("/settings/ai-provider", async (c) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, 401);
  }

  const { data, error } = await supabase
    .from("ai_provider_setting")
    .select("provider, model")
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "設定の取得に失敗しました" } }, 500);
  }

  if (!data) {
    return c.json({ provider: null, model: null, hasKey: false });
  }

  return c.json({ provider: data.provider, model: data.model, hasKey: true });
});

aiRoutes.put("/settings/ai-provider", async (c) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, 401);
  }

  const parsed = aiProviderSettingInputSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "INVALID_INPUT", message: "入力内容が不正です" } }, 400);
  }
  const { provider, model, apiKey } = parsed.data;

  if (!isSupportedModel(provider as AiProvider, model)) {
    return c.json({ error: { code: "UNSUPPORTED_MODEL", message: "許可されていないモデルです" } }, 400);
  }

  const masterKey = await getMasterKey();
  const encryptedApiKey = await encryptApiKey({ apiKey, teacherId: user.id, masterKeyBase64: masterKey });

  const { error } = await supabase
    .from("ai_provider_setting")
    .upsert(
      { teacher_id: user.id, provider, model, encrypted_api_key: encryptedApiKey },
      { onConflict: "teacher_id" },
    );

  if (error) {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "保存に失敗しました" } }, 500);
  }

  return c.json({ provider, model, hasKey: true });
});

aiRoutes.post("/comments/generate", async (c) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, 401);
  }

  const body = (await c.req.json()) as { prompt?: string; targetCharCount?: number };
  if (!body.prompt || body.prompt.trim().length === 0) {
    return c.json({ error: { code: "INVALID_INPUT", message: "プロンプトが空です" } }, 400);
  }

  const { data: setting, error: settingError } = await supabase
    .from("ai_provider_setting")
    .select("provider, model, encrypted_api_key")
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (settingError) {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "設定の取得に失敗しました" } }, 500);
  }
  if (!setting) {
    return c.json({ error: { code: "NOT_CONFIGURED", message: "AIプロバイダが設定されていません" } }, 400);
  }

  try {
    const masterKey = await getMasterKey();
    const apiKey = await decryptApiKey({
      encrypted: setting.encrypted_api_key,
      teacherId: user.id,
      masterKeyBase64: masterKey,
    });

    const adapter = aiAdapters[setting.provider as AiProvider];
    const rawText = await adapter.generateComment({
      apiKey,
      model: setting.model,
      prompt: body.prompt,
    });

    return c.json({ rawText });
  } catch (err) {
    if (err instanceof AiProviderError) {
      const payload = { error: { code: err.code, message: err.message } };
      if (err.code === "RATE_LIMIT") return c.json(payload, 429);
      if (err.code === "AUTH_ERROR") return c.json(payload, 401);
      return c.json(payload, 502);
    }
    return c.json({ error: { code: "INTERNAL_ERROR", message: "所感の生成に失敗しました" } }, 500);
  }
});
