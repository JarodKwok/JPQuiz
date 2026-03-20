import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, config } = body;

    if (!config?.apiKey) {
      return NextResponse.json(
        { error: "API Key is required" },
        { status: 400 }
      );
    }

    const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    );

    // Detect if this is a Responses API endpoint or Chat Completions
    const wireApi = config.wireApi || "chat";

    if (wireApi === "responses") {
      return handleResponsesAPI(baseUrl, config, messages);
    } else {
      return handleChatCompletionsAPI(baseUrl, config, messages);
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
  const endpoint = baseUrl.includes("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[AI Chat API] Error:", res.status, errText);
    return NextResponse.json(
      { error: `AI error (${res.status}): ${errText}` },
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
  const endpoint = baseUrl.includes("/responses")
    ? baseUrl
    : `${baseUrl}/v1/responses`;

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

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o",
      instructions,
      input,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[AI Responses API] Error:", res.status, errText);
    return NextResponse.json(
      { error: `AI error (${res.status}): ${errText}` },
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

                // Handle different Responses API event types
                let content = "";

                // response.output_text.delta
                if (parsed.type === "response.output_text.delta") {
                  content = parsed.delta || "";
                }
                // response.content_part.delta (alternative format)
                else if (parsed.type === "response.content_part.delta") {
                  content = parsed.delta?.text || parsed.delta || "";
                }
                // response.completed - extract full text
                else if (parsed.type === "response.completed") {
                  const fullContent = extractResponsesContent(parsed.response);
                  if (fullContent) content = fullContent;
                }
                // Fallback: try common delta paths
                else if (parsed.delta) {
                  content =
                    typeof parsed.delta === "string"
                      ? parsed.delta
                      : parsed.delta.content || parsed.delta.text || "";
                }
                // Standard chat completions format (some proxies convert)
                else if (parsed.choices?.[0]?.delta?.content) {
                  content = parsed.choices[0].delta.content;
                }

                if (content) {
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

/** Extract text content from a Responses API response object */
function extractResponsesContent(data: Record<string, unknown>): string {
  if (!data) return "";

  // data.output[].content[].text
  const output = data.output as Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const texts = item.content
          .filter((c) => c.type === "output_text" || c.type === "text")
          .map((c) => c.text || "");
        if (texts.length) return texts.join("");
      }
    }
  }

  // Fallback: data.output_text
  if (typeof data.output_text === "string") return data.output_text;

  // Fallback: choices format
  const choices = data.choices as Array<{
    message?: { content?: string };
  }>;
  if (Array.isArray(choices) && choices[0]?.message?.content) {
    return choices[0].message.content;
  }

  return "";
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
