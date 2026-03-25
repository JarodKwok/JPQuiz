import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_SETTINGS,
  normalizeAISettings,
  normalizeStoredAIConfig,
} from "./settings";

describe("ai settings", () => {
  it("uses proxy-friendly defaults for openai", () => {
    expect(DEFAULT_AI_SETTINGS.providers.openai.model).toBe("gpt-5.4");
    expect(DEFAULT_AI_SETTINGS.providers.openai.baseUrl).toBe(
      "https://gmn.chuangzuoli.com"
    );
    expect(DEFAULT_AI_SETTINGS.providers.openai.wireApi).toBe("responses");
  });

  it("backfills missing openai fields with defaults", () => {
    const normalized = normalizeAISettings({
      activeProvider: "openai",
      providers: {
        openai: {
          apiKey: "sk-test",
        },
      },
    });

    expect(normalized.providers.openai.apiKey).toBe("sk-test");
    expect(normalized.providers.openai.model).toBe("gpt-5.4");
    expect(normalized.providers.openai.baseUrl).toBe(
      "https://gmn.chuangzuoli.com"
    );
    expect(normalized.providers.openai.wireApi).toBe("responses");
  });

  it("preserves explicit chat config and trims string inputs", () => {
    const normalized = normalizeStoredAIConfig("openai", {
      apiKey: " sk-test ",
      model: " custom-model ",
      baseUrl: " https://example.com/v1 ",
      wireApi: "chat",
    });

    expect(normalized.apiKey).toBe("sk-test");
    expect(normalized.model).toBe("custom-model");
    expect(normalized.baseUrl).toBe("https://example.com/v1");
    expect(normalized.wireApi).toBe("chat");
  });
});
