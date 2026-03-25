import type { Module } from "./index";

export interface VocabularyItem {
  word: string;
  reading: string;
  meaning: string;
  example?: string;
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

export interface ListeningItem {
  text: string;
  options: string[];
  answer: number;
}

export interface ModuleContentMap {
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  text: TextContent;
  examples: ExampleItem[];
  listening: ListeningItem[];
}

export type ModuleContent<M extends Module = Module> = ModuleContentMap[M];

export interface ContentEnvelope<M extends Module = Module> {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
  source: "cache" | "ai";
  createdAt: string;
  updatedAt: string;
}
