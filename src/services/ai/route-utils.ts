export function buildChatEndpoint(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

export function buildResponsesEndpoint(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized.endsWith("/responses")) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/responses`;
  }

  return `${normalized}/v1/responses`;
}

export function extractResponsesContent(data: Record<string, unknown>): string {
  if (!data) return "";

  const output = data.output as Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const texts = item.content
          .filter((contentItem) => {
            return (
              contentItem.type === "output_text" || contentItem.type === "text"
            );
          })
          .map((contentItem) => contentItem.text || "");

        if (texts.length > 0) {
          return texts.join("");
        }
      }
    }
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const choices = data.choices as Array<{
    message?: { content?: string };
  }>;
  if (Array.isArray(choices) && choices[0]?.message?.content) {
    return choices[0].message.content;
  }

  return "";
}

export function extractResponseEventContent(
  event: Record<string, unknown>,
  hasStreamedText: boolean
) {
  if (event.type === "response.output_text.delta") {
    return typeof event.delta === "string" ? event.delta : "";
  }

  if (event.type === "response.content_part.delta") {
    const delta = event.delta;
    if (typeof delta === "string") return delta;
    if (delta && typeof delta === "object") {
      const deltaText = (delta as { text?: string }).text;
      return typeof deltaText === "string" ? deltaText : "";
    }
    return "";
  }

  if (!hasStreamedText && event.type === "response.completed") {
    const response = event.response;
    if (response && typeof response === "object") {
      return extractResponsesContent(response as Record<string, unknown>);
    }
    return "";
  }

  const delta = event.delta;
  if (typeof delta === "string") {
    return delta;
  }

  if (delta && typeof delta === "object") {
    const deltaRecord = delta as { content?: string; text?: string };
    return deltaRecord.content || deltaRecord.text || "";
  }

  const choices = event.choices as Array<{ delta?: { content?: string } }>;
  if (Array.isArray(choices) && choices[0]?.delta?.content) {
    return choices[0].delta.content;
  }

  return "";
}
