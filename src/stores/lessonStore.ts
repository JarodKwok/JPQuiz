"use client";

import { create } from "zustand";
import type { Module } from "@/types";

const DEFAULT_LESSON = 1;
const DEFAULT_MODULE: Module = "vocabulary";

function normalizeLesson(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
    return DEFAULT_LESSON;
  }
  return parsed;
}

function normalizeModule(value: string | null): Module {
  if (
    value === "vocabulary" ||
    value === "grammar" ||
    value === "text" ||
    value === "examples"
  ) {
    return value;
  }
  return DEFAULT_MODULE;
}

interface LessonState {
  currentLesson: number;
  currentModule: Module;
  hydrated: boolean;
  hydrate: () => void;
  setCurrentLesson: (lesson: number) => void;
  setCurrentModule: (module: Module) => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  currentLesson: DEFAULT_LESSON,
  currentModule: DEFAULT_MODULE,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;

    set({
      currentLesson: normalizeLesson(
        localStorage.getItem("jpquiz-current-lesson")
      ),
      currentModule: normalizeModule(
        localStorage.getItem("jpquiz-current-module")
      ),
      hydrated: true,
    });
  },

  setCurrentLesson: (lesson: number) => {
    set({ currentLesson: lesson });
    if (typeof window !== "undefined") {
      localStorage.setItem("jpquiz-current-lesson", String(lesson));
    }
  },

  setCurrentModule: (module: Module) => {
    set({ currentModule: module });
    if (typeof window !== "undefined") {
      localStorage.setItem("jpquiz-current-module", module);
    }
  },
}));
