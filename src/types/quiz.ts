import type { Module } from "./index";

export const QUIZ_QUESTION_TYPES = [
  "multiple_choice",
  "fill_blank",
  "translation",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export const QUIZ_SOURCE_TYPES = [
  "random_scope",
  "manual_targets",
  "weak_items",
  "mixed",
] as const;

export type QuizSourceType = (typeof QUIZ_SOURCE_TYPES)[number];

export interface QuizResolvedTarget {
  key: string;
  label: string;
  module: Module;
  lessonId: number;
  matchedFrom?: string;
  sourceKinds?: string[];
  excerpt?: string;
}

interface BaseQuizQuestion {
  id: number;
  type: QuizQuestionType;
  prompt: string;
  explanation?: string;
  knowledgeKeys?: string[];
}

export interface MultipleChoiceQuestion extends BaseQuizQuestion {
  type: "multiple_choice";
  options: string[];
  correctIndex: number;
}

export interface FillBlankQuestion extends BaseQuizQuestion {
  type: "fill_blank";
  answer: string;
  acceptedAnswers?: string[];
  placeholder?: string;
}

export interface TranslationQuestion extends BaseQuizQuestion {
  type: "translation";
  direction: "zh-to-ja" | "ja-to-zh";
  answer: string;
  acceptedAnswers?: string[];
  placeholder?: string;
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | FillBlankQuestion
  | TranslationQuestion;

export interface QuizData {
  title: string;
  lessonId?: number;
  module?: Module;
  sourceType?: QuizSourceType;
  questionType?: QuizQuestionType;
  count?: number;
  resolvedTargets?: Array<Pick<QuizResolvedTarget, "key" | "label">>;
  questions: QuizQuestion[];
}

export type QuizDraftAnswer = number | string | null;

export interface QuizAnswer {
  questionId: number;
  answer: QuizDraftAnswer;
}

export interface QuizResult {
  questionId: number;
  questionType: QuizQuestionType;
  isCorrect: boolean;
  userAnswer: QuizDraftAnswer;
  correctAnswer: string;
  explanation?: string;
  knowledgeKeys: string[];
}

export interface QuizSubmission {
  quizTitle: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  results: QuizResult[];
}

export interface QuizSessionQuestionRecord extends QuizResult {
  prompt: string;
}

export interface QuizSessionRecord {
  id?: number;
  title: string;
  lessonId: number;
  module: Module;
  sourceType: QuizSourceType;
  questionType: QuizQuestionType;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  targetLabels?: string[];
  results: QuizSessionQuestionRecord[];
  createdAt: string;
}

/** AI 响应的结构化内容类型 */
export type AIContentBlock =
  | { type: "text"; content: string }
  | { type: "quiz"; data: QuizData };
