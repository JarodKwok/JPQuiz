import type {
  AIProviderConfig,
  AISettings,
  AITutorSettings,
  AIMemoryPolicySettings,
} from "@/types";

type PartialAISettings = Partial<Omit<AISettings, "providers" | "tutor">> & {
  providers?: Record<string, Partial<AIProviderConfig>>;
  tutor?: Partial<Omit<AITutorSettings, "memoryPolicy">> & {
    memoryPolicy?: Partial<AIMemoryPolicySettings>;
  };
};

const EMPTY_PROVIDER_CONFIG: AIProviderConfig = {
  apiKey: "",
  model: "",
  baseUrl: "",
  wireApi: "chat",
};

/* ------------------------------------------------------------------ */
/*  供应商预设注册表 — 新增厂商只需在这里加一条                            */
/* ------------------------------------------------------------------ */

export interface ProviderPreset {
  key: string;
  name: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl: string;
  defaultWireApi: "chat" | "responses";
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: "openai",
    name: "OpenAI / 代理",
    description: "默认预填 gpt-5.4 + Responses API",
    defaultModel: "gpt-5.4",
    defaultBaseUrl: "https://gmn.chuangzuoli.com",
    defaultWireApi: "responses",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    description: "聚合多厂商模型，统一 API 入口",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultWireApi: "chat",
  },
  {
    key: "kimi",
    name: "Kimi (月之暗面)",
    description: "Moonshot 系列模型",
    defaultModel: "moonshot-v1-8k",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultWireApi: "chat",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek Chat / Reasoner",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultWireApi: "chat",
  },
];

const PRESET_MAP = new Map(PROVIDER_PRESETS.map((p) => [p.key, p]));

const DEFAULT_MEMORY_POLICY: AIMemoryPolicySettings = {
  recentTurns: 3,
  weakItemsLimit: 5,
  recentWrongAnswersLimit: 5,
  summarizeEveryTurns: 8,
  maxLongTermMemoriesPerRequest: 3,
  totalSoftTokenLimit: 2200,
  moduleContextItemsLimit: 12,
};

const DEFAULT_TUTOR_SETTINGS: AITutorSettings = {
  assistantName: "みな先生",
  customTutorPrompt:
    "你是一个认真、克制、擅长循序渐进讲解的日语老师。优先围绕《大家的日语》与学习者当前课次回答。默认先短答，严格按用户要求的粒度输出；如果用户只要列表或筛选结果，就不要自动扩展成逐项详解。讲解时尽量结构化，并在必要时用表格帮助学习者对比记忆。",
  teachingStyle: "structured",
  answerFormatPreference: "table-first",
  memoryPolicy: DEFAULT_MEMORY_POLICY,
};

function buildDefaultProviders(): Record<string, AIProviderConfig> {
  const providers: Record<string, AIProviderConfig> = {};
  for (const preset of PROVIDER_PRESETS) {
    providers[preset.key] = {
      apiKey: "",
      model: preset.defaultModel,
      baseUrl: preset.defaultBaseUrl,
      wireApi: preset.defaultWireApi,
    };
  }
  return providers;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: "openai",
  providers: buildDefaultProviders(),
  tutor: DEFAULT_TUTOR_SETTINGS,
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

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

  const isCustom = !PRESET_MAP.has(provider);

  const result: AIProviderConfig = {
    apiKey: merged.apiKey.trim(),
    model: merged.model.trim() || defaults.model,
    baseUrl: merged.baseUrl.trim() || defaults.baseUrl,
    wireApi:
      merged.wireApi === "responses" || merged.wireApi === "chat"
        ? merged.wireApi
        : defaults.wireApi,
  };

  // 自定义供应商保留 displayName
  if (isCustom && merged.displayName) {
    result.displayName = merged.displayName.trim();
  }

  return result;
}

function normalizeMemoryPolicy(
  memoryPolicy?: Partial<AIMemoryPolicySettings>
): AIMemoryPolicySettings {
  return {
    recentTurns: clampInt(
      memoryPolicy?.recentTurns,
      DEFAULT_MEMORY_POLICY.recentTurns,
      1,
      8
    ),
    weakItemsLimit: clampInt(
      memoryPolicy?.weakItemsLimit,
      DEFAULT_MEMORY_POLICY.weakItemsLimit,
      0,
      15
    ),
    recentWrongAnswersLimit: clampInt(
      memoryPolicy?.recentWrongAnswersLimit,
      DEFAULT_MEMORY_POLICY.recentWrongAnswersLimit,
      0,
      15
    ),
    summarizeEveryTurns: clampInt(
      memoryPolicy?.summarizeEveryTurns,
      DEFAULT_MEMORY_POLICY.summarizeEveryTurns,
      4,
      20
    ),
    maxLongTermMemoriesPerRequest: clampInt(
      memoryPolicy?.maxLongTermMemoriesPerRequest,
      DEFAULT_MEMORY_POLICY.maxLongTermMemoriesPerRequest,
      0,
      8
    ),
    totalSoftTokenLimit: clampInt(
      memoryPolicy?.totalSoftTokenLimit,
      DEFAULT_MEMORY_POLICY.totalSoftTokenLimit,
      800,
      8000
    ),
    moduleContextItemsLimit: clampInt(
      memoryPolicy?.moduleContextItemsLimit,
      DEFAULT_MEMORY_POLICY.moduleContextItemsLimit,
      3,
      30
    ),
  };
}

function normalizeTutorSettings(
  tutor?: Partial<Omit<AITutorSettings, "memoryPolicy">> & {
    memoryPolicy?: Partial<AIMemoryPolicySettings>;
  }
): AITutorSettings {
  const merged = {
    ...DEFAULT_TUTOR_SETTINGS,
    ...(tutor ?? {}),
  };

  return {
    assistantName:
      typeof merged.assistantName === "string" &&
      merged.assistantName.trim().length > 0
        ? merged.assistantName.trim()
        : DEFAULT_TUTOR_SETTINGS.assistantName,
    customTutorPrompt:
      typeof merged.customTutorPrompt === "string" &&
      merged.customTutorPrompt.trim().length > 0
        ? merged.customTutorPrompt.trim()
        : DEFAULT_TUTOR_SETTINGS.customTutorPrompt,
    teachingStyle:
      merged.teachingStyle === "concise" ||
      merged.teachingStyle === "structured" ||
      merged.teachingStyle === "coach"
        ? merged.teachingStyle
        : DEFAULT_TUTOR_SETTINGS.teachingStyle,
    answerFormatPreference:
      merged.answerFormatPreference === "table-first" ||
      merged.answerFormatPreference === "bullet-first" ||
      merged.answerFormatPreference === "mixed"
        ? merged.answerFormatPreference
        : DEFAULT_TUTOR_SETTINGS.answerFormatPreference,
    memoryPolicy: normalizeMemoryPolicy(tutor?.memoryPolicy),
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
    tutor: normalizeTutorSettings(settings?.tutor),
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

export function getDefaultTutorSettings() {
  return DEFAULT_TUTOR_SETTINGS;
}

/** 获取供应商显示信息：优先从预设取，自定义供应商则用 config.displayName */
export function getProviderDisplayInfo(
  key: string,
  config?: AIProviderConfig
): { name: string; description: string; isPreset: boolean } {
  const preset = PRESET_MAP.get(key);
  if (preset) {
    return { name: preset.name, description: preset.description, isPreset: true };
  }
  return {
    name: config?.displayName || key,
    description: "自定义 OpenAI 兼容 API",
    isPreset: false,
  };
}
