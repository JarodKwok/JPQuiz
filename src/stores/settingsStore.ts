"use client";

import { create } from "zustand";
import type { AISettings } from "@/types";

const DEFAULT_SETTINGS: AISettings = {
  activeProvider: "openai",
  providers: {
    openai: {
      apiKey: "",
      model: "gpt-4.1",
      baseUrl: "https://api.openai.com/v1",
      wireApi: "chat" as const,
    },
    kimi: {
      apiKey: "",
      model: "moonshot-v1-8k",
      baseUrl: "https://api.moonshot.cn/v1",
      wireApi: "chat" as const,
    },
    deepseek: {
      apiKey: "",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      wireApi: "chat" as const,
    },
  },
};

interface SettingsState {
  ai: AISettings;
  setActiveProvider: (provider: string) => void;
  setProviderConfig: (
    provider: string,
    key: string,
    value: string
  ) => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ai: DEFAULT_SETTINGS,

  setActiveProvider: (provider: string) => {
    set((state) => ({
      ai: { ...state.ai, activeProvider: provider },
    }));
    get().saveSettings();
  },

  setProviderConfig: (provider: string, key: string, value: string) => {
    set((state) => ({
      ai: {
        ...state.ai,
        providers: {
          ...state.ai.providers,
          [provider]: {
            ...state.ai.providers[provider],
            [key]: value,
          },
        },
      },
    }));
    get().saveSettings();
  },

  loadSettings: () => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("jpquiz-ai-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        const providers = {
          ...DEFAULT_SETTINGS.providers,
          ...(parsed.providers || {}),
        };

        if (providers.openai?.model === "gpt-5.4") {
          providers.openai = {
            ...providers.openai,
            model: DEFAULT_SETTINGS.providers.openai.model,
          };
        }

        set({
          ai: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            providers,
          },
        });
      }
    } catch {
      // ignore parse errors
    }
  },

  saveSettings: () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jpquiz-ai-settings", JSON.stringify(get().ai));
  },
}));
