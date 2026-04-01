import { db } from "./db";
import { emitDataUpdated } from "./events";
import type { LearningProgress, MasteryLevel, Module } from "@/types";
import { MODULES } from "@/types";
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
  const now = new Date().toISOString();
  const existing = await db.learningProgress
    .where({ lessonId, module })
    .first();

  const payload: LearningProgress = {
    lessonId,
    module,
    masteryPercent,
    totalItems: itemKeys.length,
    lastStudiedAt: now,
    updatedAt: now,
  };

  if (existing?.id) {
    await db.learningProgress.update(existing.id, payload);
  } else {
    await db.learningProgress.add(payload);
  }

  emitDataUpdated();
  return masteryPercent;
}

export async function recordStudySession(
  module: Module,
  lessonId: number,
  durationSeconds: number
) {
  if (durationSeconds < 5) return;

  await db.studySessions.add({
    date: new Date().toISOString().slice(0, 10),
    durationSeconds,
    module,
    lessonId,
  });

  emitDataUpdated();
}

export async function getTodayStudyMinutes() {
  const today = new Date().toISOString().slice(0, 10);
  const sessions = await db.studySessions.where("date").equals(today).toArray();
  const totalSeconds = sessions.reduce(
    (sum, session) => sum + session.durationSeconds,
    0
  );

  return Math.round(totalSeconds / 60);
}

export async function getLessonProgressSummary(lessonId: number) {
  const progressList = await db.learningProgress.where("lessonId").equals(lessonId).toArray();
  const summary = {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
  } satisfies Record<Module, number>;

  for (const item of progressList) {
    summary[item.module] = item.masteryPercent;
  }

  return summary;
}

export async function getHistoryStats(): Promise<HistoryStats> {
  const [progressList, masteryList, sessions, wrongAnswersCount, quizSessions] =
    await Promise.all([
    db.learningProgress.toArray(),
    db.masteryStatus.toArray(),
    db.studySessions.toArray(),
    db.wrongAnswers.count(),
    db.quizSessions.toArray(),
  ]);

  const studiedLessonSet = new Set<number>();
  for (const progress of progressList) {
    studiedLessonSet.add(progress.lessonId);
  }
  for (const session of sessions) {
    if (typeof session.lessonId === "number") {
      studiedLessonSet.add(session.lessonId);
    }
  }
  for (const quizSession of quizSessions) {
    studiedLessonSet.add(quizSession.lessonId);
  }

  const moduleMasteryCounts = {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
  } satisfies Record<Module, number>;

  const moduleProgressTotals = {
    vocabulary: { total: 0, count: 0 },
    grammar: { total: 0, count: 0 },
    text: { total: 0, count: 0 },
    examples: { total: 0, count: 0 },
  } satisfies Record<Module, { total: number; count: number }>;

  for (const mastery of masteryList) {
    if (mastery.status === "mastered") {
      moduleMasteryCounts[mastery.module] += 1;
    }
  }

  for (const progress of progressList) {
    moduleProgressTotals[progress.module].total += progress.masteryPercent;
    moduleProgressTotals[progress.module].count += 1;
  }

  const moduleProgress = MODULES.reduce(
    (accumulator, module) => {
      const current = moduleProgressTotals[module];
      accumulator[module] =
        current.count > 0 ? Math.round(current.total / current.count) : 0;
      return accumulator;
    },
    {
      vocabulary: 0,
      grammar: 0,
      text: 0,
      examples: 0,
    } as Record<Module, number>
  );

  const totalStudySeconds = sessions.reduce(
    (sum, session) => sum + session.durationSeconds,
    0
  );

  const quizAccuracyTotals = {
    multiple_choice: { correct: 0, total: 0 },
    fill_blank: { correct: 0, total: 0 },
    translation: { correct: 0, total: 0 },
  } satisfies Record<QuizQuestionType, { correct: number; total: number }>;

  for (const session of quizSessions) {
    quizAccuracyTotals[session.questionType].correct += session.correctCount;
    quizAccuracyTotals[session.questionType].total += session.totalQuestions;
  }

  const quizAccuracyByType = {
    multiple_choice:
      quizAccuracyTotals.multiple_choice.total > 0
        ? Math.round(
            (quizAccuracyTotals.multiple_choice.correct /
              quizAccuracyTotals.multiple_choice.total) *
              100
          )
        : 0,
    fill_blank:
      quizAccuracyTotals.fill_blank.total > 0
        ? Math.round(
            (quizAccuracyTotals.fill_blank.correct /
              quizAccuracyTotals.fill_blank.total) *
              100
          )
        : 0,
    translation:
      quizAccuracyTotals.translation.total > 0
        ? Math.round(
            (quizAccuracyTotals.translation.correct /
              quizAccuracyTotals.translation.total) *
              100
          )
        : 0,
  } satisfies Record<QuizQuestionType, number>;

  const weakItems = masteryList
    .filter((item) => item.status === "weak" || item.status === "fuzzy")
    .sort((left, right) => right.reviewCount - left.reviewCount)
    .slice(0, 5)
    .map((item) => ({
      itemKey: item.itemKey,
      lessonId: item.lessonId,
      module: item.module,
      status: item.status,
      reviewCount: item.reviewCount,
    }));

  const masteredItems = masteryList.filter(
    (item) => item.status === "mastered"
  ).length;

  const recentQuizSessions = [...quizSessions]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
    .map((session) => ({
      title: session.title,
      lessonId: session.lessonId,
      module: session.module,
      questionType: session.questionType,
      sourceType: session.sourceType,
      accuracy: session.accuracy,
      createdAt: session.createdAt,
    }));

  return {
    lessonsStudied: studiedLessonSet.size,
    masteredItems,
    totalStudyMinutes: Math.round(totalStudySeconds / 60),
    wrongAnswersCount,
    totalQuizSessions: quizSessions.length,
    moduleMasteryCounts,
    moduleProgress,
    quizAccuracyByType,
    recentQuizSessions,
    weakItems,
  };
}
