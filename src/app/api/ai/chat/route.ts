import { NextRequest, NextResponse } from "next/server";
import {
  buildChatEndpoint,
  buildResponsesEndpoint,
  extractResponseEventContent,
  extractResponsesContent,
} from "@/services/ai/route-utils";
import { normalizeStoredAIConfig } from "@/services/ai/settings";

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

      const delayMs = getRetryDelayMs(
        attempt,
        res.headers.get("retry-after")
      );
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
  try {
    const body = await req.json();
    const { messages, config, provider } = body;
    const normalizedConfig = normalizeStoredAIConfig(provider, config);

    if (!normalizedConfig.apiKey) {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    const baseUrl = normalizedConfig.baseUrl.replace(/\/$/, "");
    const wireApi = normalizedConfig.wireApi || "chat";

    if (wireApi === "responses") {
      return handleResponsesAPI(baseUrl, normalizedConfig, messages);
    } else {
      return handleChatCompletionsAPI(baseUrl, normalizedConfig, messages);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI API] Exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Standard OpenAI Chat Completions API (/v1/chat/completions) */
async function handleChatCompletionsAPI(
  baseUrl: string,
  config: { apiKey: string; model: string },
  messages: { role: string; content: string }[]
) {
  const endpoint = buildChatEndpoint(baseUrl);

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-5.4",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const message = extractUpstreamErrorMessage(errText);
    console.error("[AI Chat API] Error:", res.status, message);
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
  config: { apiKey: string; model: string },
  messages: { role: string; content: string }[]
) {
  const endpoint = buildResponsesEndpoint(baseUrl);

  // Convert chat messages to Responses API input format
  const input = messages
    .filter((m: { role: string }) => m.role !== "system")
    .map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

  const systemMsg = messages.find(
    (m: { role: string }) => m.role === "system"
  );
  const instructions = systemMsg?.content || "";

  const res = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-5.4",
      instructions,
      input,
      stream: true,
    }),
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

  // Non-streaming JSON response
  if (contentType.includes("application/json")) {
    const data = await res.json();
    console.log("[AI Responses API] JSON response:", JSON.stringify(data).slice(0, 300));
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

            // Responses API uses "event:" and "data:" lines
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = extractResponseEventContent(
                  parsed,
                  hasStreamedText
                );

                if (content) {
                  hasStreamedText = true;
                  const chatChunk = JSON.stringify({
                    choices: [{ delta: { content } }],
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${chatChunk}\n\n`)
                  );
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
    console.log("[AI Chat API] JSON response:", JSON.stringify(data).slice(0, 200));
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
