import { NextRequest, NextResponse } from "next/server";
import {
  buildChatEndpoint,
  buildResponsesEndpoint,
  extractResponseEventContent,
  extractResponsesContent,
} from "@/services/ai/route-utils";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import {
  currentYearMonth,
  getAdminModelConfig,
  getMonthlyUsage,
  incrementMonthlyUsage,
  type AdminModelConfig,
} from "@/lib/db/repos/admin-config-repo";
import {
  FREE_MONTHLY_QUOTA,
  PREMIUM_MONTHLY_QUOTA,
} from "@/lib/db/config";
import {
  getServerUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

const MAX_UPSTREAM_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function shouldRetryStatus(status: number) {
  return RETRYABLE_STATUSES.has(status);
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(dateMs - Date.now(), 0);
  }

  return null;
}

function getRetryDelayMs(attempt: number, retryAfter: string | null) {
  return parseRetryAfterMs(retryAfter) ?? 400 * 2 ** attempt;
}

function extractUpstreamErrorMessage(rawText: string) {
  try {
    const parsed = JSON.parse(rawText);

    if (typeof parsed === "string") {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      if (
        "error" in parsed &&
        parsed.error &&
        typeof parsed.error === "object" &&
        "message" in parsed.error &&
        typeof parsed.error.message === "string"
      ) {
        return parsed.error.message;
      }

      if ("error" in parsed && typeof parsed.error === "string") {
        return parsed.error;
      }

      if ("message" in parsed && typeof parsed.message === "string") {
        return parsed.message;
      }
    }
  } catch {
    // keep raw text
  }

  return rawText;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_UPSTREAM_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !shouldRetryStatus(res.status) || attempt === MAX_UPSTREAM_RETRIES) {
        return res;
      }

      const delayMs = getRetryDelayMs(attempt, res.headers.get("retry-after"));
      console.warn(
        `[AI API] Upstream ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_UPSTREAM_RETRIES + 1})`
      );
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_UPSTREAM_RETRIES) {
        throw error;
      }

      const delayMs = 400 * 2 ** attempt;
      console.warn(
        `[AI API] Upstream fetch failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_UPSTREAM_RETRIES + 1})`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI upstream request failed");
}

export async function POST(req: NextRequest) {
  // ── 1. 鉴权 ────────────────────────────────────────────────────────────
  let userId: string;
  try {
    userId = await getServerUserId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    throw err;
  }

  const account = findAccountById(userId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  // ── 2. 配额检查 ────────────────────────────────────────────────────────
  const isPremium =
    account.tier === "premium" && (account.tierExpiresAt ?? 0) > Date.now();
  const monthlyQuota = isPremium ? PREMIUM_MONTHLY_QUOTA : FREE_MONTHLY_QUOTA;
  const yearMonth = currentYearMonth();
  const used = getMonthlyUsage(userId, yearMonth);

  if (used >= monthlyQuota) {
    return NextResponse.json(
      {
        error: "quota_exhausted",
        message: isPremium
          ? "本月会员配额已用完，下月初自动恢复"
          : "本月免费 AI 次数已用完，升级会员可获得更多额度",
        monthlyQuota,
        used,
        remaining: 0,
        isPremium,
        yearMonth,
      },
      { status: 402 }
    );
  }

  // ── 3. 读 admin 配置 ───────────────────────────────────────────────────
  const cfg = getAdminModelConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error: "service_not_configured",
        message: "管理员尚未配置 AI 服务，请联系管理员",
      },
      { status: 503 }
    );
  }

  // ── 4. 解析请求体（messages 必填，jsonMode 可选；其它字段忽略）─────────
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const messages = body.messages as { role: string; content: string }[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const jsonMode = !!body.jsonMode;

  // ── 5. 计数 +1（先扣后调上游，防滥用）─────────────────────────────────
  incrementMonthlyUsage(userId, yearMonth);

  // ── 6. 调上游 ───────────────────────────────────────────────────────────
  try {
    const baseUrl = cfg.baseUrl.replace(/\/$/, "");
    if (cfg.wireApi === "responses") {
      return await handleResponsesAPI(baseUrl, cfg, messages);
    } else {
      return await handleChatCompletionsAPI(baseUrl, cfg, messages, { jsonMode });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    console.error("[AI API] Exception:", message, "\n", stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Standard OpenAI Chat Completions API (/v1/chat/completions) */
async function handleChatCompletionsAPI(
  baseUrl: string,
  cfg: AdminModelConfig,
  messages: { role: string; content: string }[],
  options: { jsonMode: boolean }
) {
  const endpoint = buildChatEndpoint(baseUrl);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://jpquiz.app";
    headers["X-Title"] = "JPQuiz";
  }

  const baseBody: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  };

  if (options.jsonMode) {
    baseBody.response_format = { type: "json_object" };
  }

  console.log("[AI Chat API] Request:", {
    endpoint,
    model: cfg.model,
    provider: cfg.provider,
    messageCount: messages.length,
  });

  let res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...baseBody, stream: true }),
  });

  if (!res.ok) {
    console.warn("[AI Chat API] Stream failed, retrying without streaming...");
    res = await fetchWithRetry(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(baseBody),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    const message = extractUpstreamErrorMessage(errText);
    console.error("[AI Chat API] Error:", res.status, message, errText.slice(0, 500));
    return NextResponse.json(
      {
        error:
          res.status === 503
            ? `上游模型服务暂时不可用，已自动重试。${message}`
            : `AI error (${res.status}): ${message}`,
      },
      { status: res.status }
    );
  }

  return forwardOrConvertStream(res);
}

/** OpenAI Responses API (/v1/responses) */
async function handleResponsesAPI(
  baseUrl: string,
  cfg: AdminModelConfig,
  messages: { role: string; content: string }[]
) {
  const endpoint = buildResponsesEndpoint(baseUrl);

  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const systemMsg = messages.find((m) => m.role === "system");
  const instructions = systemMsg?.content || "";

  const reqBody: Record<string, unknown> = {
    model: cfg.model,
    instructions,
    input,
    stream: true,
  };
  if (cfg.reasoningEffort) {
    reqBody.reasoning = { effort: cfg.reasoningEffort };
  }

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    const message = extractUpstreamErrorMessage(errText);
    console.error("[AI Responses API] Error:", res.status, message);
    return NextResponse.json(
      {
        error:
          res.status === 503
            ? `上游模型服务暂时不可用，已自动重试。${message}`
            : `AI error (${res.status}): ${message}`,
      },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json();
    const content = extractResponsesContent(data);
    return sseFromText(content || "AI 未返回有效内容。");
  }

  // Streaming SSE - convert Responses API events to Chat Completions format
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let hasStreamedText = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = extractResponseEventContent(parsed, hasStreamedText);

                if (content) {
                  hasStreamedText = true;
                  const chatChunk = JSON.stringify({
                    choices: [{ delta: { content } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${chatChunk}\n\n`));
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        console.error("[AI Responses API] Stream error:", err);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** Create an SSE response from plain text */
function sseFromText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
        )
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** Forward stream or convert JSON to SSE */
async function forwardOrConvertStream(res: globalThis.Response): Promise<Response> {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content || "AI 未返回有效内容。";
    return sseFromText(content);
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
