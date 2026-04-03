"use client";

import { useEffect, useMemo, useState } from "react";
import type { AIProviderConfig, AISettings } from "@/types";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  DEFAULT_AI_SETTINGS,
  PROVIDER_PRESETS,
  getProviderDisplayInfo,
} from "@/services/ai/settings";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  静态常量                                                            */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "providers", label: "模型配置", sublabel: "モデル" },
  { key: "tutor", label: "导师设置", sublabel: "チューター" },
  { key: "memory", label: "记忆策略", sublabel: "メモリー" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TEACHING_STYLES = [
  { value: "concise", label: "简洁", description: "先给结论，再补必要解释。" },
  { value: "structured", label: "结构化", description: "优先表格和分点，适合系统复习。" },
  { value: "coach", label: "陪练教练", description: "更强调薄弱点提醒和下一步训练。" },
] as const;

const ANSWER_FORMATS = [
  { value: "table-first", label: "表格优先", description: "对比和归纳时尽量用表格。" },
  { value: "bullet-first", label: "列表优先", description: "优先用短列表，减少冗余。" },
  { value: "mixed", label: "混合", description: "让 AI 根据问题自动选择格式。" },
] as const;

const MEMORY_LAYER_SECTIONS = [
  {
    id: "conversation", badge: "L1", title: "会话记忆",
    description: "控制当前对话线程中保留多少最近消息，以及何时把旧消息压缩成摘要。",
    items: [
      { key: "recentTurns", label: "最近保留轮数", hint: "多轮追问时回放最近几轮用户/助手消息。" },
      { key: "summarizeEveryTurns", label: "总结触发轮数", hint: "旧消息达到阈值后压缩为对话摘要。" },
    ],
  },
  {
    id: "snapshot", badge: "L2", title: "学习快照",
    description: "控制每次请求注入多少当前学习状态，包括薄弱项、错题和课内内容摘要。",
    items: [
      { key: "weakItemsLimit", label: "薄弱点数量", hint: "注入当前课相关薄弱项上限。" },
      { key: "recentWrongAnswersLimit", label: "错题数量", hint: "注入最近错题上限。" },
      { key: "moduleContextItemsLimit", label: "课内内容条数", hint: "注入当前模块内容摘要条数上限。" },
    ],
  },
  {
    id: "long-term", badge: "L3", title: "长期记忆",
    description: "控制每次请求最多带入多少条稳定偏好或长期弱项。当前是占位层，后续会继续增强。",
    items: [
      { key: "maxLongTermMemoriesPerRequest", label: "长期记忆条数", hint: "每次请求最多带入的长期记忆条数。" },
    ],
  },
  {
    id: "budget", badge: "L4", title: "上下文预算",
    description: "控制整次请求的软预算，后续会用它裁剪不同层的上下文体积。",
    items: [
      { key: "totalSoftTokenLimit", label: "上下文 Token 软上限", hint: "用于后续裁剪上下文预算。" },
    ],
  },
] as const;

const PRESET_KEYS = new Set(PROVIDER_PRESETS.map((p) => p.key));

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { ai, loadSettings, saveSettings } = useSettingsStore();
  const [draft, setDraft] = useState<AISettings>(ai);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("providers");

  // 自定义供应商
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customDisplayName, setCustomDisplayName] = useState("");

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const loaded = await loadSettings();
      if (!isMounted) return;
      setDraft(loaded);
      setIsLoading(false);
    })();
    return () => { isMounted = false; };
  }, [loadSettings]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(ai),
    [ai, draft]
  );

  const providerList = useMemo(() => {
    const keys = new Set([
      ...PROVIDER_PRESETS.map((p) => p.key),
      ...Object.keys(draft.providers),
    ]);
    return Array.from(keys).map((key) => {
      const info = getProviderDisplayInfo(key, draft.providers[key]);
      const preset = PROVIDER_PRESETS.find((p) => p.key === key);
      return {
        key,
        name: info.name,
        description: info.description,
        isPreset: info.isPreset,
        defaultModel: preset?.defaultModel ?? "",
        defaultBaseUrl: preset?.defaultBaseUrl ?? "",
      };
    });
  }, [draft.providers]);

  /* ── Updaters ── */

  function touchDraft() {
    setSaveState("idle");
    setSaveMessage("");
  }

  function updateActiveProvider(provider: string) {
    setDraft((c) => ({ ...c, activeProvider: provider }));
    touchDraft();
  }

  function updateProviderConfig(provider: string, key: keyof AIProviderConfig, value: string) {
    setDraft((c) => ({
      ...c,
      providers: { ...c.providers, [provider]: { ...c.providers[provider], [key]: value } },
    }));
    touchDraft();
  }

  function addCustomProvider() {
    const key = customKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!key || draft.providers[key]) return;
    setDraft((c) => ({
      ...c,
      providers: {
        ...c.providers,
        [key]: { apiKey: "", model: "", baseUrl: "", wireApi: "chat" as const, displayName: customDisplayName.trim() || key },
      },
    }));
    setCustomKey("");
    setCustomDisplayName("");
    setShowAddCustom(false);
    touchDraft();
  }

  function removeCustomProvider(key: string) {
    if (PRESET_KEYS.has(key)) return;
    setDraft((c) => {
      const { [key]: _, ...rest } = c.providers;
      return { ...c, providers: rest, activeProvider: c.activeProvider === key ? "openai" : c.activeProvider };
    });
    touchDraft();
  }

  function updateTutorSetting<K extends keyof AISettings["tutor"]>(key: K, value: AISettings["tutor"][K]) {
    setDraft((c) => ({ ...c, tutor: { ...c.tutor, [key]: value } }));
    touchDraft();
  }

  function updateMemoryPolicy<K extends keyof AISettings["tutor"]["memoryPolicy"]>(key: K, value: number) {
    setDraft((c) => ({
      ...c,
      tutor: { ...c.tutor, memoryPolicy: { ...c.tutor.memoryPolicy, [key]: value } },
    }));
    touchDraft();
  }

  function resetDraft() {
    setDraft(ai);
    touchDraft();
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
      setSaveMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  /* ── Render ── */

  return (
    <div className="flex flex-col h-full">
      {/* ── Header + Tabs ── */}
      <div className="shrink-0">
        {/* Title row */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">
              设置
              <span className="text-text-muted font-normal ml-2 text-sm">せってい</span>
            </h1>
            {isLoading && (
              <p className="text-[11px] text-text-muted mt-1">正在读取已保存配置...</p>
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

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-4 py-2.5 text-sm transition-colors rounded-t-lg",
                activeTab === tab.key
                  ? "text-primary font-medium"
                  : "text-text-muted hover:text-text"
              )}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] ml-1.5 opacity-50">{tab.sublabel}</span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0">
        {activeTab === "providers" && (
          <ProvidersTab
            draft={draft}
            isLoading={isLoading}
            providerList={providerList}
            showAddCustom={showAddCustom}
            customKey={customKey}
            customDisplayName={customDisplayName}
            onSetShowAddCustom={setShowAddCustom}
            onSetCustomKey={setCustomKey}
            onSetCustomDisplayName={setCustomDisplayName}
            onUpdateActiveProvider={updateActiveProvider}
            onUpdateProviderConfig={updateProviderConfig}
            onAddCustomProvider={addCustomProvider}
            onRemoveCustomProvider={removeCustomProvider}
          />
        )}

        {activeTab === "tutor" && (
          <TutorTab
            draft={draft}
            isLoading={isLoading}
            onUpdateTutorSetting={updateTutorSetting}
          />
        )}

        {activeTab === "memory" && (
          <MemoryTab
            draft={draft}
            isLoading={isLoading}
            onUpdateMemoryPolicy={updateMemoryPolicy}
          />
        )}
      </div>

      {/* ── Save status ── */}
      <div
        className={cn(
          "mt-6 shrink-0 rounded-xl px-4 py-3 text-xs border",
          saveState === "error"
            ? "bg-red-500/5 border-red-500/20 text-red-600"
            : saveState === "saved"
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700"
              : "bg-bg-sidebar border-border text-text-muted"
        )}
      >
        {saveMessage ||
          (isDirty
            ? "当前修改尚未写入本地加密存储，点击「保存设置」后才会生效。"
            : "当前显示的是已保存配置。")}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Tab: 模型配置                                                      */
/* ================================================================== */

interface ProviderInfo {
  key: string;
  name: string;
  description: string;
  isPreset: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
}

function ProvidersTab({
  draft,
  isLoading,
  providerList,
  showAddCustom,
  customKey,
  customDisplayName,
  onSetShowAddCustom,
  onSetCustomKey,
  onSetCustomDisplayName,
  onUpdateActiveProvider,
  onUpdateProviderConfig,
  onAddCustomProvider,
  onRemoveCustomProvider,
}: {
  draft: AISettings;
  isLoading: boolean;
  providerList: ProviderInfo[];
  showAddCustom: boolean;
  customKey: string;
  customDisplayName: string;
  onSetShowAddCustom: (v: boolean) => void;
  onSetCustomKey: (v: string) => void;
  onSetCustomDisplayName: (v: string) => void;
  onUpdateActiveProvider: (key: string) => void;
  onUpdateProviderConfig: (provider: string, key: keyof AIProviderConfig, value: string) => void;
  onAddCustomProvider: () => void;
  onRemoveCustomProvider: (key: string) => void;
}) {
  return (
    <div>
      {/* Provider selector */}
      <div className="mb-6">
        <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
          选择 AI 供应商
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {providerList.map((p) => (
            <button
              type="button"
              key={p.key}
              disabled={isLoading}
              onClick={() => onUpdateActiveProvider(p.key)}
              className={cn(
                "text-left px-4 py-3 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-60 relative group",
                draft.activeProvider === p.key
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              <p className="text-sm font-medium text-text">{p.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{p.description}</p>
              {!p.isPreset && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveCustomProvider(p.key); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                             text-text-muted hover:text-red-500 transition-opacity text-xs"
                  title="删除自定义供应商"
                >
                  x
                </button>
              )}
            </button>
          ))}

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onSetShowAddCustom(true)}
            className="text-left px-4 py-3 rounded-xl border border-dashed border-border
                       hover:border-primary/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <p className="text-sm text-text-muted">+ 添加供应商</p>
            <p className="text-[11px] text-text-muted mt-0.5">任何 OpenAI 兼容 API</p>
          </button>
        </div>
      </div>

      {/* 添加自定义供应商 */}
      {showAddCustom && (
        <div className="mb-6 bg-bg-card border border-primary/30 rounded-xl p-5">
          <h3 className="text-sm font-medium text-text mb-3">添加自定义供应商</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">标识（英文，唯一 key）</label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => onSetCustomKey(e.target.value)}
                placeholder="my-provider"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">显示名称</label>
              <input
                type="text"
                value={customDisplayName}
                onChange={(e) => onSetCustomDisplayName(e.target.value)}
                placeholder="My Provider"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onAddCustomProvider}
              disabled={!customKey.trim() || !!draft.providers[customKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")]}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => { onSetShowAddCustom(false); onSetCustomKey(""); onSetCustomDisplayName(""); }}
              className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-primary/30"
            >
              取消
            </button>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            添加后可在下方编辑 API Key、模型和 Base URL。支持任何 OpenAI Chat Completions 兼容的接口。
          </p>
        </div>
      )}

      {/* Provider configs */}
      <div className="space-y-6">
        {providerList.map((p) => {
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">当前使用</span>
                )}
                {!p.isPreset && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">自定义</span>
                )}
              </h3>

              <div className="space-y-3">
                {!p.isPreset && (
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">显示名称</label>
                    <input
                      type="text"
                      value={config.displayName ?? ""}
                      disabled={isLoading}
                      onChange={(e) => onUpdateProviderConfig(p.key, "displayName", e.target.value)}
                      placeholder={p.key}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-text-muted mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={config.apiKey}
                    disabled={isLoading}
                    onChange={(e) => onUpdateProviderConfig(p.key, "apiKey", e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Model</label>
                    <input
                      type="text"
                      value={config.model}
                      disabled={isLoading}
                      onChange={(e) => onUpdateProviderConfig(p.key, "model", e.target.value)}
                      placeholder={p.defaultModel || "model-name"}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                    {p.key === "openai" && (
                      <p className="text-[11px] text-text-muted mt-1">默认已预填你的代理配置，可按代理兼容情况改成其他模型。</p>
                    )}
                    {p.key === "openrouter" && (
                      <p className="text-[11px] text-text-muted mt-1">格式为 vendor/model，如 anthropic/claude-sonnet-4、openai/gpt-4o</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Base URL</label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      disabled={isLoading}
                      onChange={(e) => onUpdateProviderConfig(p.key, "baseUrl", e.target.value)}
                      placeholder={p.defaultBaseUrl || "https://api.example.com/v1"}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">API 格式</label>
                  <select
                    value={config.wireApi || "chat"}
                    disabled={isLoading}
                    onChange={(e) => onUpdateProviderConfig(p.key, "wireApi", e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                  >
                    <option value="chat">Chat Completions（标准）</option>
                    <option value="responses">Responses API（部分代理）</option>
                  </select>
                  {p.key === "openai" && (
                    <p className="text-[11px] text-text-muted mt-1">你当前这类 OpenAI 兼容代理，通常优先选择「Responses API」。</p>
                  )}
                  {p.key === "openrouter" && (
                    <p className="text-[11px] text-text-muted mt-1">OpenRouter 使用标准 Chat Completions 格式。</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-6 bg-bg-sidebar rounded-xl px-4 py-3 text-xs text-text-muted">
        <p>API Key 与模型配置会在你点击「保存设置」后，使用本地加密再写入当前浏览器。</p>
        <p className="mt-1">内置预设已预填默认模型和地址，只需填 API Key 即可使用。</p>
        <p className="mt-1">点击「+ 添加供应商」可接入任何 OpenAI Chat Completions 兼容的 API，如 Groq、Together AI、Ollama 等。</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Tab: 导师设置                                                      */
/* ================================================================== */

function TutorTab({
  draft,
  isLoading,
  onUpdateTutorSetting,
}: {
  draft: AISettings;
  isLoading: boolean;
  onUpdateTutorSetting: <K extends keyof AISettings["tutor"]>(key: K, value: AISettings["tutor"][K]) => void;
}) {
  return (
    <div>
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 导师名字 */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">导师名字</label>
            <input
              type="text"
              value={draft.tutor.assistantName}
              disabled={isLoading}
              onChange={(e) => onUpdateTutorSetting("assistantName", e.target.value)}
              placeholder="みな先生"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
            />
            <p className="text-[11px] text-text-muted mt-1">用于 Tutor 系统提示词，让 AI 以固定身份回应学习者。</p>
          </div>

          {/* 教学风格 */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">教学风格</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEACHING_STYLES.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  disabled={isLoading}
                  onClick={() => onUpdateTutorSetting("teachingStyle", item.value)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border transition-colors disabled:opacity-60",
                    draft.tutor.teachingStyle === item.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <p className="text-sm text-text">{item.label}</p>
                  <p className="text-[11px] text-text-muted mt-1">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 输出格式偏好 */}
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted mb-1 block">输出格式偏好</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ANSWER_FORMATS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  disabled={isLoading}
                  onClick={() => onUpdateTutorSetting("answerFormatPreference", item.value)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border transition-colors disabled:opacity-60",
                    draft.tutor.answerFormatPreference === item.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <p className="text-sm text-text">{item.label}</p>
                  <p className="text-[11px] text-text-muted mt-1">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 个性化导师提示词 */}
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted mb-1 block">个性化导师提示词</label>
            <textarea
              value={draft.tutor.customTutorPrompt}
              disabled={isLoading}
              onChange={(e) => onUpdateTutorSetting("customTutorPrompt", e.target.value)}
              rows={6}
              placeholder="例如：讲解动词时优先输出原型、类别、礼貌体、中文意思。"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60 resize-y"
            />
            <p className="text-[11px] text-text-muted mt-1">
              这层会叠加在系统安全基座之上，适合描述你的教学偏好，不建议写结构化 JSON 规则。
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-bg-sidebar rounded-xl px-4 py-3 text-xs text-text-muted">
        <p>导师设置会跟随当前站点一起加密保存，便于后续继续调优。</p>
        <p className="mt-1">与黄赌毒、政治、宗教、战争、暴力等相关的安全基座提示词保持内置，不会被自定义配置覆盖。</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Tab: 记忆策略                                                      */
/* ================================================================== */

function MemoryTab({
  draft,
  isLoading,
  onUpdateMemoryPolicy,
}: {
  draft: AISettings;
  isLoading: boolean;
  onUpdateMemoryPolicy: <K extends keyof AISettings["tutor"]["memoryPolicy"]>(key: K, value: number) => void;
}) {
  return (
    <div>
      {/* 分层概览 */}
      <div className="mb-5 rounded-xl border border-border bg-bg-sidebar px-4 py-3 text-xs text-text-muted">
        <p className="text-text-secondary">当前 Tutor 采用分层记忆：</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEMORY_LAYER_SECTIONS.map((section) => (
            <span
              key={section.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-1"
            >
              <span className="text-[10px] font-semibold text-primary">{section.badge}</span>
              <span>{section.title}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-1">
            <span className="text-[10px] font-semibold text-text-muted">固定</span>
            <span>安全基座</span>
          </span>
        </div>
      </div>

      {/* 各层配置 */}
      <div className="space-y-4">
        {MEMORY_LAYER_SECTIONS.map((section) => (
          <div key={section.id} className="rounded-xl border border-border bg-bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary">
                    {section.badge}
                  </span>
                  <h3 className="text-sm font-medium text-text">{section.title}</h3>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{section.description}</p>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-3",
                section.items.length === 1
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {section.items.map((item) => {
                const value = draft.tutor.memoryPolicy[item.key as keyof typeof draft.tutor.memoryPolicy];
                return (
                  <div key={item.key} className="rounded-xl border border-border bg-bg p-3">
                    <label className="text-xs text-text-muted mb-1 block">{item.label}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={value}
                      disabled={isLoading}
                      onChange={(e) =>
                        onUpdateMemoryPolicy(
                          item.key as keyof typeof draft.tutor.memoryPolicy,
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
                    />
                    <p className="text-[11px] text-text-muted mt-1 leading-5">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-6 bg-bg-sidebar rounded-xl px-4 py-3 text-xs text-text-muted">
        <p>记忆策略控制每次 AI 请求注入的上下文量，直接影响回答质量和 Token 消耗。</p>
        <p className="mt-1">如果你切换到不同端口的 localhost，浏览器会把它视为不同站点，配置不会自动共享。</p>
      </div>
    </div>
  );
}
