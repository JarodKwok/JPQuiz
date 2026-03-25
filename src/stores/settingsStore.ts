"use client";

import { create } from "zustand";
import type { AISettings } from "@/types";
import {
  loadSecureAISettings,
  saveSecureAISettings,
} from "@/services/secure-settings";
import {
  DEFAULT_AI_SETTINGS,
  normalizeAISettings,
} from "@/services/ai/settings";

interface SettingsState {
  ai: AISettings;
  loadSettings: () => Promise<AISettings>;
  saveSettings: (settings: AISettings) => Promise<AISettings>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ai: DEFAULT_AI_SETTINGS,

  loadSettings: async () => {
    if (typeof window === "undefined") {
      return DEFAULT_AI_SETTINGS;
    }

    try {
      const parsed = await loadSecureAISettings();
      const normalized = normalizeAISettings(parsed);
      set({ ai: normalized });
      return normalized;
    } catch {
      set({ ai: DEFAULT_AI_SETTINGS });
      return DEFAULT_AI_SETTINGS;
    }
  },

  saveSettings: async (settings) => {
    const normalized = normalizeAISettings(settings);

    if (typeof window !== "undefined") {
      await saveSecureAISettings(normalized);
    }

    set({ ai: normalized });
    return normalized;
  },
}));
