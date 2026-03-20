"use client";

import { create } from "zustand";
import type { Module } from "@/types";

interface LessonState {
  currentLesson: number;
  currentModule: Module;
  setCurrentLesson: (lesson: number) => void;
  setCurrentModule: (module: Module) => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  currentLesson: 1,
  currentModule: "vocabulary",

  setCurrentLesson: (lesson: number) => {
    set({ currentLesson: lesson });
    if (typeof window !== "undefined") {
      localStorage.setItem("jpquiz-current-lesson", String(lesson));
    }
  },

  setCurrentModule: (module: Module) => {
    set({ currentModule: module });
  },
}));
