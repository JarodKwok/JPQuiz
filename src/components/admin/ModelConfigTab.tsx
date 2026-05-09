"use client";

import { useEffect, useState } from "react";
import { PROVIDER_PRESETS } from "@/services/ai/settings";
import { cn } from "@/lib/utils";

interface ServerConfig {
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  model: string;
  wireApi: "chat" | "responses";
  reasoningEffort: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

const CUSTOM_KEY = "custom";

export default function ModelConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [draft, setDraft] = useState({
    provider: "openrouter",
    baseUrl: "",
    apiKey: "", // 空 = 保留已存储 key
    model: "",
    wireApi: "chat" as "chat" | "responses",
    reasoningEffort: "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/model-config", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const { config } = await res.json();
          if (config) {
            setServerConfig(config);
            setDraft({
              provider: config.provider,
              baseUrl: config.baseUrl,
              apiKey: "",
              model: config.model,
              wireApi: config.wireApi,
              reasoningEffort: config.reasoningEffort ?? "",
            });
          } else {
            // 无配置 → 用 OpenRouter 预设作为初始 draft
            const preset = PROVIDER_PRESETS.find((p) => p.key === "openrouter")!;
            setDraft({
              provider: preset.key,
              baseUrl: preset.defaultBaseUrl,
              apiKey: "",
              model: preset.defaultModel,
              wireApi: preset.defaultWireApi,
              reasoningEffort: "",
            });
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function pickPreset(key: string) {
    setSaveState("idle");
    setSaveMsg("");
    if (key === CUSTOM_KEY) {
      setDraft((c) => ({ ...c, provider: CUSTOM_KEY }));
      return;
    }
    const preset = PROVIDER_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setDraft((c) => ({
      ...c,
      provider: preset.key,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
      wireApi: preset.defaultWireApi,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveState("idle");
    setSaveMsg("");
    try {
      const payload: Record<string, unknown> = {
        provider: draft.provider,
        baseUrl: draft.baseUrl.trim(),
        model: draft.model.trim(),
        wireApi: draft.wireApi,
        reasoningEffort: draft.reasoningEffort.trim() || null,
      };
      if (draft.apiKey.trim()) {
        payload.apiKey = draft.apiKey.trim();
      } else if (!serverConfig?.hasApiKey) {
        setSaveState("error");
        setSaveMsg("首次配置需要填写 API Key");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveState("error");
        setSaveMsg(data.error || "保存失败");
        return;
      }
      setServerConfig(data.config);
      setDraft((c) => ({ ...c, apiKey: "" }));
      setSaveState("saved");
      setSaveMsg("已保存。所有用户的 AI 调用将使用此配置。");
    } catch (e) {
      setSaveState("error");
      setSaveMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-text-muted">加载中...</div>;
  }

  const providerOptions = [
    ...PROVIDER_PRESETS.map((p) => ({ key: p.key, name: p.name, desc: p.description })),
    { key: CUSTOM_KEY, name: "自定义", desc: "手动填写 base URL 与 model" },
  ];

  return (
    <div className="space-y-6">
      {/* 服务端状态卡片 */}
      <div className="rounded-xl border border-border bg-bg-sidebar/40 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs">
            <div className="text-text-muted mb-1">服务端当前配置（所有用户共享）</div>
            {serverConfig ? (
              <div className="space-y-0.5 text-text">
                <div>
                  <span className="text-text-muted">Provider：</span>
                  {serverConfig.provider}
                </div>
                <div>
                  <span className="text-text-muted">Model：</span>
                  {serverConfig.model}
                </div>
                <div>
                  <span className="text-text-muted">API Key：</span>
                  <span className="font-mono text-[11px]">{serverConfig.apiKeyMasked}</span>
                </div>
                <div className="text-text-muted text-[11px] mt-1">
                  最后更新：{new Date(serverConfig.updatedAt).toLocaleString("zh-CN")}
                </div>
              </div>
            ) : (
              <div className="text-amber-600">尚未配置 — 用户调用 AI 会得到 503 错误</div>
            )}
          </div>
        </div>
      </div>

      {/* Provider 选择 */}
      <div>
        <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
          供应商模板
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {providerOptions.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => pickPreset(p.key)}
              className={cn(
                "text-left px-4 py-3 rounded-xl border transition-all",
                draft.provider === p.key
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              <p className="text-sm font-medium text-text">{p.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 字段表单 */}
      <div className="space-y-4 rounded-xl border border-border bg-bg-card p-4">
        <FormField
          label="Base URL"
          value={draft.baseUrl}
          onChange={(v) => setDraft((c) => ({ ...c, baseUrl: v }))}
          placeholder="https://openrouter.ai/api/v1"
        />
        <FormField
          label="Model"
          value={draft.model}
          onChange={(v) => setDraft((c) => ({ ...c, model: v }))}
          placeholder="openai/gpt-5.4"
        />
        <FormField
          label="API Key"
          value={draft.apiKey}
          onChange={(v) => setDraft((c) => ({ ...c, apiKey: v }))}
          placeholder={
            serverConfig?.hasApiKey
              ? `已保存（${serverConfig.apiKeyMasked}），留空保留`
              : "sk-or-v1-..."
          }
          isPassword
          hint="API Key 仅存储在服务端，永不下发到客户端浏览器。"
        />
        <div>
          <label className="text-xs text-text-muted block mb-1.5">Wire API</label>
          <div className="flex gap-2">
            {(["chat", "responses"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDraft((c) => ({ ...c, wireApi: w }))}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  draft.wireApi === w
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:border-primary/30"
                )}
              >
                {w === "chat" ? "Chat Completions" : "Responses (新)"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            OpenRouter / Kimi / DeepSeek 用 Chat；OpenAI o-系列推理模型用 Responses。
          </p>
        </div>
        {draft.wireApi === "responses" && (
          <FormField
            label="Reasoning Effort（可选）"
            value={draft.reasoningEffort}
            onChange={(v) => setDraft((c) => ({ ...c, reasoningEffort: v }))}
            placeholder="medium / high"
            hint="Responses API 专用，控制思考深度。"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium
                     hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存到服务端"}
        </button>
        {saveState === "saved" && (
          <span className="text-xs text-emerald-600">{saveMsg}</span>
        )}
        {saveState === "error" && (
          <span className="text-xs text-red-600">{saveMsg}</span>
        )}
      </div>

      <div className="text-[11px] text-text-muted leading-relaxed">
        提示：保存后，所有用户调用 AI 走同一套配置。每个账户的对话历史 / 记忆 / 上下文按 user 隔离，
        互不可见。用户的月度调用次数受其会员档位决定（免费 5 次 / 付费 100 次，集中常量可调）。
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  isPassword,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isPassword?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1.5">{label}</label>
      <input
        type={isPassword ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text
                   placeholder:text-text-muted focus:outline-none focus:border-primary
                   font-mono"
      />
      {hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
    </div>
  );
}
