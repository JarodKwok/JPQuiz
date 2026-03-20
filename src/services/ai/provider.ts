import type { AISettings } from "@/types";
import type { AIProvider } from "./types";
import { OpenAIAdapter } from "./openai-adapter";

export function createAIProvider(settings: AISettings): AIProvider {
  const providerName = settings.activeProvider;
  const config = settings.providers[providerName];

  if (!config) {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }

  if (!config.apiKey) {
    throw new Error(
      `API Key not configured for ${providerName}. Please go to Settings to configure it.`
    );
  }

  // All supported providers (OpenAI, Kimi, DeepSeek) use OpenAI-compatible API
  return new OpenAIAdapter({
    name: providerName,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
  });
}
