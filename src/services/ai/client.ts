"use client";

import type { AIMessage } from "@/types";

const RETRYABLE_LOCAL_STATUSES = new Set([429, 502, 503, 504]);
const MAX_LOCAL_RETRIES = 1;

/**
 * /api/ai/chat 上游或本地配额错误。带 code 让调用方按场景渲染：
 *   quota_exhausted        — 本月配额用尽（402）
 *   service_not_configured — admin 还没填模型配置（503）
 *   unauthenticated        — 没登录（401）
 *   upstream               — 上游/未知错误
 */
export type AIErrorCode =
  | "quota_exhausted"
  | "service_not_configured"
  | "unauthenticated"
  | "upstream";

export class AIRequestError extends Error {
  status: number;
  code: AIErrorCode;
  serverMessage: string;
  isPremium?: boolean;

  constructor(opts: {
    status: number;
    code: AIErrorCode;
    serverMessage: string;
    isPremium?: boolean;
  }) {
    super(opts.serverMessage || `AI 请求失败 (${opts.status})`);
    this.name = "AIRequestError";
    this.status = opts.status;
    this.code = opts.code;
    this.serverMessage = opts.serverMessage;
    this.isPremium = opts.isPremium;
  }
}

interface ParsedErrorBody {
  message: string;
  code: AIErrorCode;
  isPremium?: boolean;
}

function parseErrorBody(status: number, errText: string): ParsedErrorBody {
  let raw: unknown = null;
  try {
    raw = JSON.parse(errText);
  } catch {
    // 非 JSON：原文当 message
    return { message: errText, code: status === 401 ? "unauthenticated" : "upstream" };
  }

  // 优先解析服务端结构化字段
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const errField = obj.error;
  let message = "";
  let codeStr = "";

  if (typeof obj.message === "string") message = obj.message;
  if (typeof errField === "string") {
    codeStr = errField;
    if (!message) message = errField;
  } else if (errField && typeof errField === "object") {
    const inner = errField as Record<string, unknown>;
    if (typeof inner.message === "string") message = message || inner.message;
  }
  if (!message && typeof raw === "string") message = raw;

  let code: AIErrorCode = "upstream";
  if (codeStr === "quota_exhausted") code = "quota_exhausted";
  else if (codeStr === "service_not_configured") code = "service_not_configured";
  else if (codeStr === "unauthenticated" || status === 401) code = "unauthenticated";

  return {
    message: message || `AI 请求失败 (${status})`,
    code,
    isPremium: typeof obj.isPremium === "boolean" ? obj.isPremium : undefined,
  };
}

export async function streamAIText(
  messages: AIMessage[],
  onDeltaOrOptions?:
    | ((chunk: string, fullText: string) => void)
    | { onDelta?: (chunk: string, fullText: string) => void; jsonMode?: boolean },
) {
  const onDelta =
    typeof onDeltaOrOptions === "function"
      ? onDeltaOrOptions
      : onDeltaOrOptions?.onDelta;
  const jsonMode =
    typeof onDeltaOrOptions === "object" ? onDeltaOrOptions?.jsonMode : false;

  let res: Response | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_LOCAL_RETRIES; attempt++) {
    try {
      res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          ...(jsonMode ? { jsonMode: true } : {}),
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
    const parsed = parseErrorBody(res.status, errText);
    throw new AIRequestError({
      status: res.status,
      code: parsed.code,
      serverMessage: parsed.message,
      isPremium: parsed.isPremium,
    });
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
