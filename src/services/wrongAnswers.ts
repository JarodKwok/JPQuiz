import { db } from "./db";
import type { Module, WrongAnswer } from "@/types";
import type { QuizQuestionType, QuizSourceType } from "@/types/quiz";
import { emitDataUpdated } from "./events";

export interface WrongAnswerInput {
  lessonId: number;
  module: Module;
  question: string;
  userAnswer?: string;
  correctAnswer: string;
  errorReason?: string;
  status?: "mastered" | "weak";
  questionType?: QuizQuestionType;
  sourceType?: QuizSourceType;
  knowledgeKeys?: string[];
}

export async function saveWrongAnswer(input: WrongAnswerInput) {
  await db.wrongAnswers.add({
    ...input,
    status: input.status || "weak",
    createdAt: new Date().toISOString(),
  });
  emitDataUpdated();
}

export async function listWrongAnswers(): Promise<WrongAnswer[]> {
  return db.wrongAnswers.orderBy("createdAt").reverse().toArray();
}

export async function listWrongAnswersByScope(
  lessonId: number,
  module: Module
): Promise<WrongAnswer[]> {
  const items = await db.wrongAnswers.where({ lessonId, module }).toArray();
  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getWrongAnswerCount() {
  return db.wrongAnswers.count();
}
