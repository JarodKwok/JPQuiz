import { describe, expect, it } from "vitest";
import {
  buildChatEndpoint,
  buildResponsesEndpoint,
  extractResponseEventContent,
  extractResponsesContent,
} from "./route-utils";

describe("AI route utils", () => {
  it("builds chat completions endpoint without duplicating suffix", () => {
    expect(buildChatEndpoint("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(buildChatEndpoint("https://proxy.example.com/chat/completions")).toBe(
      "https://proxy.example.com/chat/completions"
    );
  });

  it("builds responses endpoint without duplicating v1", () => {
    expect(buildResponsesEndpoint("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/responses"
    );
    expect(buildResponsesEndpoint("https://proxy.example.com/v1/responses")).toBe(
      "https://proxy.example.com/v1/responses"
    );
    expect(buildResponsesEndpoint("https://proxy.example.com")).toBe(
      "https://proxy.example.com/v1/responses"
    );
  });

  it("extracts response content from response objects and stream events", () => {
    expect(
      extractResponsesContent({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "hello" }],
          },
        ],
      })
    ).toBe("hello");

    expect(
      extractResponseEventContent(
        { type: "response.output_text.delta", delta: "hel" },
        false
      )
    ).toBe("hel");

    expect(
      extractResponseEventContent(
        {
          type: "response.completed",
          response: {
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "done" }],
              },
            ],
          },
        },
        false
      )
    ).toBe("done");

    expect(
      extractResponseEventContent(
        {
          type: "response.completed",
          response: {
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "done" }],
              },
            ],
          },
        },
        true
      )
    ).toBe("");
  });
});
