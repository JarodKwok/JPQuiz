"use client";

import { create } from "zustand";
import type { Module } from "@/types";
import { getCurrentUserId } from "@/services/account";

const DEFAULT_LESSON = 1;
const DEFAULT_MODULE: Module = "vocabulary";

function lsKey(key: string) {
  return `jpquiz-${getCurrentUserId()}-${key}`;
}

/** 读取旧 key（无 userId 前缀的）或新 key 的值 */
function lsGet(key: string) {
  if (typeof window === "undefined") return null;
  // 优先读新 key，兼容旧 key
  return localStorage.getItem(lsKey(key)) ?? localStorage.getItem(`jpquiz-${key}`);
}

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
      currentLesson: normalizeLesson(lsGet("current-lesson")),
      currentModule: normalizeModule(lsGet("current-module")),
      hydrated: true,
    });
  },

  setCurrentLesson: (lesson: number) => {
    set({ currentLesson: lesson });
    if (typeof window !== "undefined") {
      localStorage.setItem(lsKey("current-lesson"), String(lesson));
    }
  },

  setCurrentModule: (module: Module) => {
    set({ currentModule: module });
    if (typeof window !== "undefined") {
      localStorage.setItem(lsKey("current-module"), module);
    }
  },
}));
