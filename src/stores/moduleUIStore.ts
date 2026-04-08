"use client";

import { create } from "zustand";
import type { Module } from "@/types";
import type {
  QuizData,
  QuizDraftAnswer,
  QuizQuestionType,
  QuizSourceType,
  QuizSubmission,
} from "@/types/quiz";

// ── 筛选 & 显示状态（学习页） ──────────────────────────────────────────────

type FilterMode = "all" | "weak" | "fuzzy" | "unlearned";

export interface ModuleViewState {
  mode: "study" | "quiz";
  filter: FilterMode;
  tagFilter: string | null;
  showNumbers: boolean;
  showJapaneseGlobal: boolean;
  showMeaningGlobal: boolean;
  showKanjiGlobal: boolean;
}

const DEFAULT_VIEW_STATE: ModuleViewState = {
  mode: "study",
  filter: "all",
  tagFilter: null,
  showNumbers: true,
  showJapaneseGlobal: true,
  showMeaningGlobal: true,
  showKanjiGlobal: false,
};

// ── 测验状态 ─────────────────────────────────────────────────────────────

export interface ModuleQuizState {
  questionType: QuizQuestionType;
  sourceType: QuizSourceType;
  count: number;
  quiz: QuizData | null;
  answers: Record<number, QuizDraftAnswer>;
  submission: QuizSubmission | null;
}

const DEFAULT_QUIZ_STATE: ModuleQuizState = {
  questionType: "multiple_choice",
  sourceType: "random_scope",
  count: 5,
  quiz: null,
  answers: {},
  submission: null,
};

// ── Store ────────────────────────────────────────────────────────────────

function stateKey(lessonId: number, module: Module) {
  return `${lessonId}_${module}`;
}

interface ModuleUIStore {
  viewStates: Record<string, Partial<ModuleViewState>>;
  quizStates: Record<string, Partial<ModuleQuizState>>;

  getViewState: (lessonId: number, module: Module) => ModuleViewState;
  setViewState: (
    lessonId: number,
    module: Module,
    patch: Partial<ModuleViewState>
  ) => void;

  getQuizState: (lessonId: number, module: Module) => ModuleQuizState;
  setQuizState: (
    lessonId: number,
    module: Module,
    patch: Partial<ModuleQuizState>
  ) => void;
  clearQuiz: (lessonId: number, module: Module) => void;
}

export const useModuleUIStore = create<ModuleUIStore>((set, get) => ({
  viewStates: {},
  quizStates: {},

  getViewState: (lessonId, module) => {
    const key = stateKey(lessonId, module);
    return { ...DEFAULT_VIEW_STATE, ...get().viewStates[key] };
  },

  setViewState: (lessonId, module, patch) => {
    const key = stateKey(lessonId, module);
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: { ...state.viewStates[key], ...patch },
      },
    }));
  },

  getQuizState: (lessonId, module) => {
    const key = stateKey(lessonId, module);
    return { ...DEFAULT_QUIZ_STATE, ...get().quizStates[key] };
  },

  setQuizState: (lessonId, module, patch) => {
    const key = stateKey(lessonId, module);
    set((state) => ({
      quizStates: {
        ...state.quizStates,
        [key]: { ...state.quizStates[key], ...patch },
      },
    }));
  },

  clearQuiz: (lessonId, module) => {
    const key = stateKey(lessonId, module);
    set((state) => ({
      quizStates: {
        ...state.quizStates,
        [key]: { ...DEFAULT_QUIZ_STATE },
      },
    }));
  },
}));
