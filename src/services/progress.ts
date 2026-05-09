import { emitDataUpdated } from "./events";
import type { MasteryLevel, Module } from "@/types";
import type { ModuleContent } from "@/types/content";
import type { QuizQuestionType, QuizSourceType } from "@/types/quiz";
import { getModuleItemKeys } from "./content";

const MASTERY_SCORE: Record<MasteryLevel, number> = {
  mastered: 100,
  fuzzy: 50,
  weak: 0,
  new: 0,
};

export interface HistoryStats {
  lessonsStudied: number;
  masteredItems: number;
  totalStudyMinutes: number;
  wrongAnswersCount: number;
  totalQuizSessions: number;
  moduleMasteryCounts: Record<Module, number>;
  moduleProgress: Record<Module, number>;
  quizAccuracyByType: Record<QuizQuestionType, number>;
  recentQuizSessions: Array<{
    title: string;
    lessonId: number;
    module: Module;
    questionType: QuizQuestionType;
    sourceType: QuizSourceType;
    accuracy: number;
    createdAt: string;
  }>;
  weakItems: Array<{
    itemKey: string;
    lessonId: number;
    module: Module;
    status: MasteryLevel;
    reviewCount: number;
  }>;
}

export function calculateMasteryPercent(
  itemKeys: string[],
  masteryMap: Record<string, MasteryLevel | undefined>
) {
  if (itemKeys.length === 0) return 0;

  const totalScore = itemKeys.reduce((sum, itemKey) => {
    const mastery = masteryMap[itemKey] || "new";
    return sum + MASTERY_SCORE[mastery];
  }, 0);

  return Math.round(totalScore / itemKeys.length);
}

export async function syncLearningProgress<M extends Module>(
  lessonId: number,
  module: M,
  data: ModuleContent<M>,
  masteryMap: Record<string, MasteryLevel | undefined>
) {
  const itemKeys = getModuleItemKeys(lessonId, module, data);
  const masteryPercent = calculateMasteryPercent(itemKeys, masteryMap);

  await fetch("/api/db/progress/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lessonId,
      module,
      masteryPercent,
      totalItems: itemKeys.length,
    }),
  });

  emitDataUpdated();
  return masteryPercent;
}

export async function recordStudySession(
  module: Module,
  lessonId: number,
  durationSeconds: number
) {
  if (durationSeconds < 5) return;

  await fetch("/api/db/progress/record-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      durationSeconds,
      module,
      lessonId,
    }),
  });

  emitDataUpdated();
}

export async function clearStudySessions() {
  await fetch("/api/db/progress/clear-sessions", { method: "POST" });
  emitDataUpdated();
}

export async function getTodayStudyMinutes() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`/api/db/progress/today-minutes?date=${today}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.minutes;
}

export async function getLessonProgressSummary(lessonId: number) {
  const res = await fetch(`/api/db/progress/lesson-summary?lessonId=${lessonId}`);
  if (!res.ok) {
    return { vocabulary: 0, grammar: 0, text: 0, examples: 0 };
  }
  return res.json();
}

export async function getHistoryStats(filterLessonId?: number): Promise<HistoryStats> {
  const params = new URLSearchParams();
  if (filterLessonId !== undefined) params.set("lessonId", String(filterLessonId));
  const res = await fetch(`/api/db/progress/history-stats?${params}`);
  if (!res.ok) {
    return {
      lessonsStudied: 0,
      masteredItems: 0,
      totalStudyMinutes: 0,
      wrongAnswersCount: 0,
      totalQuizSessions: 0,
      moduleMasteryCounts: { vocabulary: 0, grammar: 0, text: 0, examples: 0 },
      moduleProgress: { vocabulary: 0, grammar: 0, text: 0, examples: 0 },
      quizAccuracyByType: { multiple_choice: 0, fill_blank: 0, translation: 0 },
      recentQuizSessions: [],
      weakItems: [],
    };
  }
  return res.json();
}
