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
    expect(DEFAULT_AI_SETTINGS.tutor.assistantName).toBe("みな先生");
    expect(DEFAULT_AI_SETTINGS.tutor.memoryPolicy.recentTurns).toBe(3);
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
    expect(normalized.tutor.assistantName).toBe("みな先生");
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

  it("normalizes tutor settings and clamps memory policy", () => {
    const normalized = normalizeAISettings({
      tutor: {
        assistantName: "  日语搭子  ",
        customTutorPrompt: "  优先用表格输出  ",
        teachingStyle: "coach",
        answerFormatPreference: "mixed",
        memoryPolicy: {
          recentTurns: 99,
          weakItemsLimit: -1,
          totalSoftTokenLimit: 999999,
        },
      },
    });

    expect(normalized.tutor.assistantName).toBe("日语搭子");
    expect(normalized.tutor.customTutorPrompt).toBe("优先用表格输出");
    expect(normalized.tutor.teachingStyle).toBe("coach");
    expect(normalized.tutor.answerFormatPreference).toBe("mixed");
    expect(normalized.tutor.memoryPolicy.recentTurns).toBe(8);
    expect(normalized.tutor.memoryPolicy.weakItemsLimit).toBe(0);
    expect(normalized.tutor.memoryPolicy.totalSoftTokenLimit).toBe(8000);
  });
});
