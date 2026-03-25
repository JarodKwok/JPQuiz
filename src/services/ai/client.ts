"use client";

import type { AIMessage, AIProviderConfig, AISettings } from "@/types";

interface StoredAIConfig {
  provider: string;
  config: AIProviderConfig;
}

function getStoredAIConfig(): StoredAIConfig {
  const settingsRaw = localStorage.getItem("jpquiz-ai-settings");
  if (!settingsRaw) {
    throw new Error("请先在「设置」页面配置 AI 模型和 API Key。");
  }

  const settings = JSON.parse(settingsRaw) as AISettings;
  const provider = settings.activeProvider || "openai";
  const config = settings.providers?.[provider];

  if (!config?.apiKey) {
    throw new Error("请先在「设置」页面配置 API Key。");
  }

  return { provider, config };
}

export async function streamAIText(
  messages: AIMessage[],
  onDelta?: (chunk: string, fullText: string) => void
) {
  const { provider, config } = getStoredAIConfig();

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      provider,
      config,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    try {
      const errJson = JSON.parse(errText);
      throw new Error(errJson.error || errText);
    } catch {
      throw new Error(`请求失败 (${res.status}): ${errText}`);
    }
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
