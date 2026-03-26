"use client";

import type { Module } from "@/types";
import type { ContentEnvelope, ModuleContent } from "@/types/content";
import {
  BUILTIN_CONTENT_UPDATED_AT,
  getBuiltinModuleContent,
} from "@/data/builtin-content";
import { db } from "./db";
import { streamAIText } from "./ai/client";
import { parseModuleContent } from "./content/parsers";
import {
  MODULE_CONTENT_SYSTEM_PROMPT,
  buildModuleContentPrompt,
} from "./prompts";

const CONTENT_SCHEMA_VERSION = "2025-02-content-v1";

export async function getModuleContent<M extends Module>({
  lessonId,
  module,
  forceRefresh = false,
}: {
  lessonId: number;
  module: M;
  forceRefresh?: boolean;
}): Promise<ContentEnvelope<M>> {
  const builtin = getBuiltinModuleContent(lessonId, module);
  if (builtin) {
    return {
      lessonId,
      module,
      data: builtin,
      source: "builtin",
      createdAt: BUILTIN_CONTENT_UPDATED_AT,
      updatedAt: BUILTIN_CONTENT_UPDATED_AT,
    };
  }

  if (!forceRefresh) {
    const cached = await db.contentCache
      .where("[lessonId+module]")
      .equals([lessonId, module])
      .first();

    if (cached && cached.version === CONTENT_SCHEMA_VERSION) {
      try {
        return {
          lessonId,
          module,
          data: parseModuleContent(module, cached.content),
          source: "cache",
          createdAt: cached.createdAt,
          updatedAt: cached.updatedAt,
        };
      } catch {
        // ignore invalid cache and regenerate
      }
    }
  }

  const rawText = await streamAIText([
    { role: "system", content: MODULE_CONTENT_SYSTEM_PROMPT },
    { role: "user", content: buildModuleContentPrompt(lessonId, module) },
  ]);

  const parsed = parseModuleContent(module, rawText);
  const serialized = JSON.stringify(parsed);
  const now = new Date().toISOString();
  const cached = await db.contentCache
    .where("[lessonId+module]")
    .equals([lessonId, module])
    .first();

  if (cached?.id) {
    await db.contentCache.update(cached.id, {
      content: serialized,
      version: CONTENT_SCHEMA_VERSION,
      updatedAt: now,
    });
  } else {
    await db.contentCache.add({
      lessonId,
      module,
      content: serialized,
      version: CONTENT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    lessonId,
    module,
    data: parsed,
    source: "ai",
    createdAt: cached?.createdAt || now,
    updatedAt: now,
  };
}

export function getModuleItemKeys<M extends Module>(
  lessonId: number,
  module: M,
  data: ModuleContent<M>
) {
  switch (module) {
    case "vocabulary":
      return (data as ModuleContent<"vocabulary">).map((item) => item.word);
    case "grammar":
      return (data as ModuleContent<"grammar">).map((item) => item.id);
    case "text":
      return [`text:${lessonId}`];
    case "examples":
      return [
        ...(data as ModuleContent<"examples">).patterns.map((item) => item.id),
        ...(data as ModuleContent<"examples">).examples.map(
          (item) => item.japanese
        ),
      ];
    case "listening":
      return (data as ModuleContent<"listening">).map(
        (item, index) => `listening:${lessonId}:${index}:${item.text}`
      );
    default:
      return [];
  }
}
