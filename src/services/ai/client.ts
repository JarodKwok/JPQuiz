"use client";

import type { AIMessage, AIProviderConfig } from "@/types";
import { loadSecureAISettings } from "@/services/secure-settings";
import {
  normalizeAISettings,
  normalizeStoredAIConfig,
} from "@/services/ai/settings";

const RETRYABLE_LOCAL_STATUSES = new Set([429, 502, 503, 504]);
const MAX_LOCAL_RETRIES = 1;

interface StoredAIConfig {
  provider: string;
  config: AIProviderConfig;
}

async function getStoredAIConfig(): Promise<StoredAIConfig> {
  const rawSettings = await loadSecureAISettings();
  if (!rawSettings) {
    throw new Error("请先在「设置」页面填写并保存 AI 配置。");
  }

  const settings = normalizeAISettings(rawSettings);
  const provider = settings.activeProvider || "openai";
  const config = normalizeStoredAIConfig(provider, settings.providers?.[provider]);

  if (!config?.apiKey) {
    throw new Error("请先在「设置」页面填写并保存 API Key。");
  }

  return { provider, config };
}

function parseErrorMessage(errText: string) {
  try {
    const errJson = JSON.parse(errText);
    if (typeof errJson === "string") return errJson;
    if (errJson?.error && typeof errJson.error === "string") {
      return errJson.error;
    }
    if (errJson?.error?.message && typeof errJson.error.message === "string") {
      return errJson.error.message;
    }
    if (errJson?.message && typeof errJson.message === "string") {
      return errJson.message;
    }
  } catch {
    // keep raw text
  }

  return errText;
}

export async function streamAIText(
  messages: AIMessage[],
  onDelta?: (chunk: string, fullText: string) => void
) {
  const { provider, config } = await getStoredAIConfig();

  let res: Response | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_LOCAL_RETRIES; attempt++) {
    try {
      res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          provider,
          config,
        }),
      });

      if (
        res.ok ||
        !RETRYABLE_LOCAL_STATUSES.has(res.status) ||
        attempt === MAX_LOCAL_RETRIES
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    } catch (error) {
      lastError = error;
      if (attempt === MAX_LOCAL_RETRIES) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  if (!res) {
    throw lastError instanceof Error
      ? lastError
      : new Error("AI 请求失败。");
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`请求失败 (${res.status}): ${parseErrorMessage(errText)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.delta?.content ||
      data.error ||
      "";

    if (content && onDelta) {
      onDelta(content, content);
    }

    return content;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流。");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (!content) continue;

        fullText += content;
        onDelta?.(content, fullText);
      } catch {
        // skip malformed JSON chunks
      }
    }
  }

  if (buffer.trim() && buffer.trim().startsWith("data: ")) {
    const data = buffer.trim().slice(6);
    if (data !== "[DONE]") {
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onDelta?.(content, fullText);
        }
      } catch {
        // skip malformed JSON chunks
      }
    }
  }

  return fullText;
}
