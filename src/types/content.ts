import type { Module } from "./index";

export interface VocabularyItem {
  word: string;
  reading: string;
  meaning: string;
  example?: string;
  kanji?: string; // 日汉字形式（如果有）
}

export interface GrammarItem {
  id: string;
  name: string;
  meaning: string;
  connection: string;
  example: string;
  exampleTranslation: string;
  tip?: string;
}

export interface TextLine {
  japanese: string;
  translation: string;
  notes?: string;
}

export interface TextContent {
  title: string;
  lines: TextLine[];
}

export interface ExampleItem {
  japanese: string;
  reading: string;
  translation: string;
  grammar?: string;
}

export interface SentencePatternItem {
  id: string;
  pattern: string;
  meaning: string;
  structure: string;
  sampleJapanese: string;
  sampleReading: string;
  sampleTranslation: string;
  notes?: string;
}

export interface ExamplesContent {
  patterns: SentencePatternItem[];
  examples: ExampleItem[];
}

export interface ModuleContentMap {
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  text: TextContent;
  examples: ExamplesContent;
}

export type ModuleContent<M extends Module = Module> = ModuleContentMap[M];

export interface ContentEnvelope<M extends Module = Module> {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
  source: "builtin" | "cache" | "ai";
  createdAt: string;
  updatedAt: string;
}
