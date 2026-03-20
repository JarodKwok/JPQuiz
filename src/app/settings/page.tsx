"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  {
    key: "openai",
    name: "OpenAI",
    description: "GPT-4o / GPT-5.4 等（支持代理）",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    key: "kimi",
    name: "Kimi (月之暗面)",
    description: "Moonshot 系列模型",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek Chat / Reasoner",
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
];

export default function SettingsPage() {
  const { ai, setActiveProvider, setProviderConfig, loadSettings } =
    useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">
          设置
          <span className="text-text-muted font-normal ml-2 text-sm">
            せってい
          </span>
        </h1>
        <p className="text-xs text-text-muted mt-1">配置 AI 模型和 API Key</p>
      </div>

      {/* Provider selector */}
      <div className="mb-6">
        <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
          选择 AI 供应商
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActiveProvider(p.key)}
              className={cn(
                "text-left px-4 py-3 rounded-xl border transition-all",
                ai.activeProvider === p.key
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
          const config = ai.providers[p.key];
          if (!config) return null;
          const isActive = ai.activeProvider === p.key;

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
                    onChange={(e) =>
                      setProviderConfig(p.key, "apiKey", e.target.value)
                    }
                    placeholder="sk-..."
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               placeholder:text-text-muted focus:outline-none focus:ring-2
                               focus:ring-primary/30 focus:border-primary"
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
                      onChange={(e) =>
                        setProviderConfig(p.key, "model", e.target.value)
                      }
                      placeholder="模型名称"
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2
                                 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      onChange={(e) =>
                        setProviderConfig(p.key, "baseUrl", e.target.value)
                      }
                      placeholder={p.defaultBaseUrl}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2
                                 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    API 格式
                  </label>
                  <select
                    value={config.wireApi || "chat"}
                    onChange={(e) =>
                      setProviderConfig(p.key, "wireApi", e.target.value)
                    }
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="chat">Chat Completions（标准）</option>
                    <option value="responses">Responses API（代理常用）</option>
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    如果使用 OpenAI 代理，通常选择「Responses API」
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-6 bg-bg-sidebar rounded-xl px-4 py-3 text-xs text-text-muted">
        <p>
          API Key 仅存储在浏览器本地（localStorage），不会上传到任何服务器。
        </p>
        <p className="mt-1">
          Kimi 和 DeepSeek 兼容 OpenAI API
          格式，只需填入对应的 Key 和 Base URL 即可使用。
        </p>
      </div>
    </div>
  );
}
