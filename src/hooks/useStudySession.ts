"use client";

import { useEffect } from "react";
import type { Module } from "@/types";
import { recordStudySession } from "@/services/progress";

export function useStudySession(module: Module, lessonId: number) {
  useEffect(() => {
    const startedAt = Date.now();

    return () => {
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      void recordStudySession(module, lessonId, durationSeconds);
    };
  }, [lessonId, module]);
}
