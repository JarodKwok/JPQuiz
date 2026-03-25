import type { AIProviderConfig, AISettings } from "@/types";

type PartialAISettings = Partial<Omit<AISettings, "providers">> & {
  providers?: Record<string, Partial<AIProviderConfig>>;
};

const EMPTY_PROVIDER_CONFIG: AIProviderConfig = {
  apiKey: "",
  model: "",
  baseUrl: "",
  wireApi: "chat",
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: "openai",
  providers: {
    openai: {
      apiKey: "",
      model: "gpt-5.4",
      baseUrl: "https://gmn.chuangzuoli.com",
      wireApi: "responses",
    },
    kimi: {
      apiKey: "",
      model: "moonshot-v1-8k",
      baseUrl: "https://api.moonshot.cn/v1",
      wireApi: "chat",
    },
    deepseek: {
      apiKey: "",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      wireApi: "chat",
    },
  },
};

function normalizeProviderConfig(
  provider: string,
  config?: Partial<AIProviderConfig>
): AIProviderConfig {
  const defaults =
    DEFAULT_AI_SETTINGS.providers[provider] ?? EMPTY_PROVIDER_CONFIG;
  const merged = {
    ...defaults,
    ...(config ?? {}),
  };

  return {
    apiKey: merged.apiKey.trim(),
    model: merged.model.trim() || defaults.model,
    baseUrl: merged.baseUrl.trim() || defaults.baseUrl,
    wireApi:
      merged.wireApi === "responses" || merged.wireApi === "chat"
        ? merged.wireApi
        : defaults.wireApi,
  };
}

export function normalizeAISettings(
  settings?: PartialAISettings | null
): AISettings {
  const rawProviders = settings?.providers ?? {};
  const providerKeys = new Set([
    ...Object.keys(DEFAULT_AI_SETTINGS.providers),
    ...Object.keys(rawProviders),
  ]);
  const providers: Record<string, AIProviderConfig> = {};

  for (const provider of providerKeys) {
    providers[provider] = normalizeProviderConfig(
      provider,
      rawProviders[provider]
    );
  }

  const activeProvider =
    settings?.activeProvider && providers[settings.activeProvider]
      ? settings.activeProvider
      : DEFAULT_AI_SETTINGS.activeProvider;

  return {
    activeProvider,
    providers,
  };
}

export function normalizeStoredAIConfig(
  provider: string | undefined,
  config?: Partial<AIProviderConfig> | null
) {
  return normalizeProviderConfig(
    provider || DEFAULT_AI_SETTINGS.activeProvider,
    config ?? undefined
  );
}
