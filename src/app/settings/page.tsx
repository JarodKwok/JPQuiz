"use client";

import { useEffect, useMemo, useState } from "react";
import type { AIProviderConfig, AISettings } from "@/types";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULT_AI_SETTINGS } from "@/services/ai/settings";
import { cn } from "@/lib/utils";

const DEFAULT_OPENAI_CONFIG = DEFAULT_AI_SETTINGS.providers.openai;

const PROVIDERS = [
  {
    key: "openai",
    name: "OpenAI / 代理",
    description: "默认预填 gpt-5.4 + Responses API",
    defaultBaseUrl: DEFAULT_OPENAI_CONFIG.baseUrl,
    defaultModel: DEFAULT_OPENAI_CONFIG.model,
  },
  {
    key: "kimi",
    name: "Kimi (月之暗面)",
    description: "Moonshot 系列模型",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek Chat / Reasoner",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
];

export default function SettingsPage() {
  const { ai, loadSettings, saveSettings } = useSettingsStore();
  const [draft, setDraft] = useState<AISettings>(ai);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const loaded = await loadSettings();
      if (!isMounted) return;
      setDraft(loaded);
      setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [loadSettings]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(ai),
    [ai, draft]
  );

  function updateActiveProvider(provider: string) {
    setDraft((current) => ({
      ...current,
      activeProvider: provider,
    }));
    setSaveState("idle");
    setSaveMessage("");
  }

  function updateProviderConfig(
    provider: string,
    key: keyof AIProviderConfig,
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [provider]: {
          ...current.providers[provider],
          [key]: value,
        },
      },
    }));
    setSaveState("idle");
    setSaveMessage("");
  }

  function resetDraft() {
    setDraft(ai);
    setSaveState("idle");
    setSaveMessage("");
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveState("idle");
    setSaveMessage("");

    try {
      const saved = await saveSettings(draft);
      setDraft(saved);
      setSaveState("saved");
      setSaveMessage("设置已加密保存到当前浏览器。");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error ? error.message : "保存失败，请稍后重试。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">
            设置
            <span className="text-text-muted font-normal ml-2 text-sm">
              せってい
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            配置 AI 模型、代理地址和 API Key
          </p>
          {isLoading && (
            <p className="text-[11px] text-text-muted mt-2">
              正在读取已保存配置...
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
              有未保存更改
            </span>
          )}
          <button
            type="button"
            onClick={resetDraft}
            disabled={isLoading || isSaving || !isDirty}
            className="px-3 py-2 rounded-lg border border-border text-sm text-text-muted transition-colors
                       hover:text-text hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            恢复
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || !isDirty}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium transition-opacity
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      {/* Provider selector */}
      <div className="mb-6">
        <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
          选择 AI 供应商
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              type="button"
              key={p.key}
              disabled={isLoading}
              onClick={() => updateActiveProvider(p.key)}
              className={cn(
                "text-left px-4 py-3 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-60",
                draft.activeProvider === p.key
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              <p className="text-sm font-medium text-text">{p.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Provider configs */}
      <div className="space-y-6">
        {PROVIDERS.map((p) => {
          const config = draft.providers[p.key];
          if (!config) return null;
          const isActive = draft.activeProvider === p.key;

          return (
            <div
              key={p.key}
              className={cn(
                "bg-bg-card border rounded-xl p-5 transition-opacity",
                isActive ? "border-primary/30" : "border-border opacity-50"
              )}
            >
              <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
                {p.name}
                {isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    当前使用
                  </span>
                )}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    disabled={isLoading}
                    onChange={(e) =>
                      updateProviderConfig(p.key, "apiKey", e.target.value)
                    }
                    placeholder="sk-..."
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               placeholder:text-text-muted focus:outline-none focus:ring-2
                               focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">
                      Model
                    </label>
                    <input
                      type="text"
                      value={config.model}
                      disabled={isLoading}
                      onChange={(e) =>
                        updateProviderConfig(p.key, "model", e.target.value)
                      }
                      placeholder={p.defaultModel}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2
                                 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                    {p.key === "openai" && (
                      <p className="text-[11px] text-text-muted mt-1">
                        默认已预填你的代理配置，可按代理兼容情况改成其他模型。
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      disabled={isLoading}
                      onChange={(e) =>
                        updateProviderConfig(p.key, "baseUrl", e.target.value)
                      }
                      placeholder={p.defaultBaseUrl}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2
                                 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    API 格式
                  </label>
                  <select
                    value={config.wireApi || "chat"}
                    disabled={isLoading}
                    onChange={(e) =>
                      updateProviderConfig(p.key, "wireApi", e.target.value)
                    }
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  >
                    <option value="responses">Responses API（默认代理）</option>
                    <option value="chat">Chat Completions（标准）</option>
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    你当前这类 OpenAI 兼容代理，通常优先选择「Responses API」。
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-6 rounded-xl px-4 py-3 text-xs border",
          saveState === "error"
            ? "bg-red-500/5 border-red-500/20 text-red-600"
            : saveState === "saved"
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700"
              : "bg-bg-sidebar border-border text-text-muted"
        )}
      >
        {saveMessage ||
          (isDirty
            ? "当前修改尚未写入本地加密存储，点击“保存设置”后才会生效。"
            : "当前显示的是已保存配置。")}
      </div>

      {/* Info */}
      <div className="mt-6 bg-bg-sidebar rounded-xl px-4 py-3 text-xs text-text-muted">
        <p>
          API Key 与模型配置会在你点击“保存设置”后，使用本地加密再写入当前浏览器。
        </p>
        <p className="mt-1">
          OpenAI / 代理默认预填 `gpt-5.4`、`https://gmn.chuangzuoli.com`
          和 `Responses API`。
        </p>
        <p className="mt-1">
          Kimi 和 DeepSeek 也兼容 OpenAI API 格式，只需填入对应的 Key 和
          Base URL 即可使用。
        </p>
        <p className="mt-1">
          如果你切换到不同端口的 localhost，浏览器会把它视为不同站点，因此配置不会自动共享。
        </p>
      </div>
    </div>
  );
}
