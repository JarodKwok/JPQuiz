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
  await fetch("/api/db/wrong-answers/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      status: input.status || "weak",
      createdAt: new Date().toISOString(),
    }),
  });
  emitDataUpdated();
}

export async function listWrongAnswers(): Promise<WrongAnswer[]> {
  const res = await fetch("/api/db/wrong-answers/list");
  if (!res.ok) return [];
  return res.json();
}

export async function listWrongAnswersByScope(
  lessonId: number,
  module: Module
): Promise<WrongAnswer[]> {
  const res = await fetch(
    `/api/db/wrong-answers/list-by-scope?lessonId=${lessonId}&module=${encodeURIComponent(module)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getWrongAnswerCount() {
  const res = await fetch("/api/db/wrong-answers/count");
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count;
}
