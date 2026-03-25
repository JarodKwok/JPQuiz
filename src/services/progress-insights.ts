"use client";

import type { HistoryStats } from "./progress";
import { streamAIText } from "./ai/client";
import {
  buildProgressInsightPrompt,
  PROGRESS_INSIGHT_SYSTEM_PROMPT,
} from "./prompts";

export async function generateProgressInsight(stats: HistoryStats) {
  return streamAIText([
    { role: "system", content: PROGRESS_INSIGHT_SYSTEM_PROMPT },
    { role: "user", content: buildProgressInsightPrompt(stats) },
  ]);
}
