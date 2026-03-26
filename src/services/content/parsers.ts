import type { Module } from "@/types";
import type {
  ExampleItem,
  ExamplesContent,
  GrammarItem,
  ListeningItem,
  ModuleContent,
  SentencePatternItem,
  TextContent,
  VocabularyItem,
} from "@/types/content";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function extractJsonValue(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to more flexible extraction
  }

  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const codeBlockMatch = trimmed.match(codeBlockRegex);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  const firstBraceIndex = trimmed.search(/[\[{]/);
  if (firstBraceIndex !== -1) {
    const candidate = trimmed.slice(firstBraceIndex);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  throw new Error("AI 返回内容不是有效 JSON。");
}

function isVocabularyItem(value: unknown): value is VocabularyItem {
  return (
    isRecord(value) &&
    isString(value.word) &&
    isString(value.reading) &&
    isString(value.meaning) &&
    (value.example === undefined || typeof value.example === "string")
  );
}

function isGrammarItem(value: unknown): value is GrammarItem {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.meaning) &&
    isString(value.connection) &&
    isString(value.example) &&
    isString(value.exampleTranslation) &&
    (value.tip === undefined || typeof value.tip === "string")
  );
}

function isTextContent(value: unknown): value is TextContent {
  return (
    isRecord(value) &&
    isString(value.title) &&
    Array.isArray(value.lines) &&
    value.lines.every((line) => {
      return (
        isRecord(line) &&
        isString(line.japanese) &&
        isString(line.translation) &&
        (line.notes === undefined || typeof line.notes === "string")
      );
    })
  );
}

function isExampleItem(value: unknown): value is ExampleItem {
  return (
    isRecord(value) &&
    isString(value.japanese) &&
    isString(value.reading) &&
    isString(value.translation) &&
    (value.grammar === undefined || typeof value.grammar === "string")
  );
}

function isSentencePatternItem(value: unknown): value is SentencePatternItem {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.pattern) &&
    isString(value.meaning) &&
    isString(value.structure) &&
    isString(value.sampleJapanese) &&
    isString(value.sampleReading) &&
    isString(value.sampleTranslation) &&
    (value.notes === undefined || typeof value.notes === "string")
  );
}

function isExamplesContent(value: unknown): value is ExamplesContent {
  return (
    isRecord(value) &&
    Array.isArray(value.patterns) &&
    value.patterns.every(isSentencePatternItem) &&
    Array.isArray(value.examples) &&
    value.examples.every(isExampleItem)
  );
}

function isListeningItem(value: unknown): value is ListeningItem {
  return (
    isRecord(value) &&
    isString(value.text) &&
    Array.isArray(value.options) &&
    value.options.every(isString) &&
    typeof value.answer === "number" &&
    value.answer >= 0 &&
    value.answer < value.options.length
  );
}

export function parseModuleContent<M extends Module>(
  module: M,
  text: string
): ModuleContent<M> {
  const parsed = extractJsonValue(text);

  switch (module) {
    case "vocabulary":
      if (Array.isArray(parsed) && parsed.every(isVocabularyItem)) {
        return parsed as ModuleContent<M>;
      }
      break;
    case "grammar":
      if (Array.isArray(parsed) && parsed.every(isGrammarItem)) {
        return parsed as ModuleContent<M>;
      }
      break;
    case "text":
      if (isTextContent(parsed)) {
        return parsed as ModuleContent<M>;
      }
      break;
    case "examples":
      if (isExamplesContent(parsed)) {
        return parsed as ModuleContent<M>;
      }
      if (Array.isArray(parsed) && parsed.every(isExampleItem)) {
        return {
          patterns: [],
          examples: parsed,
        } as unknown as ModuleContent<M>;
      }
      break;
    case "listening":
      if (Array.isArray(parsed) && parsed.every(isListeningItem)) {
        return parsed as ModuleContent<M>;
      }
      break;
    default:
      break;
  }

  throw new Error(`AI 返回的 ${module} 内容格式不符合预期。`);
}
