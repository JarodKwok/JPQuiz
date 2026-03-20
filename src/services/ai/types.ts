import type { AIMessage, AIRequestOptions, AIResponse } from "@/types";

export interface AIProvider {
  name: string;
  chat(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse>;
  stream(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<ReadableStream<string>>;
}
