import type { AiProvider } from "@/shared/ai-models";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import { openaiAdapter } from "./openai";
import type { AiAdapter } from "./types";

export const aiAdapters: Record<AiProvider, AiAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
};

export { AiProviderError } from "./types";
export type { AiAdapter } from "./types";
