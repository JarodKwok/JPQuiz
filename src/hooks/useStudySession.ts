"use client";

import { useEffect } from "react";
import type { Module } from "@/types";
import { recordStudySession } from "@/services/progress";

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟无操作视为不活跃

export function useStudySession(module: Module, lessonId: number) {
  useEffect(() => {
    let activeSeconds = 0;
    let lastTick = Date.now();
    let isActive = true;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const pauseTracking = () => {
      if (isActive) {
        activeSeconds += (Date.now() - lastTick) / 1000;
        isActive = false;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const resumeTracking = () => {
      if (!isActive) {
        lastTick = Date.now();
        isActive = true;
      }
      resetIdleTimer();
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(pauseTracking, IDLE_TIMEOUT_MS);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        pauseTracking();
      } else {
        resumeTracking();
      }
    };

    // 用户活跃事件（throttle：最多每 30 秒处理一次）
    let lastActivityAt = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityAt < 30_000) return;
      lastActivityAt = now;
      resumeTracking();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("mousemove", handleActivity, { passive: true });

    resetIdleTimer();

    return () => {
      if (isActive) {
        activeSeconds += (Date.now() - lastTick) / 1000;
      }
      if (idleTimer) clearTimeout(idleTimer);

      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("mousemove", handleActivity);

      void recordStudySession(module, lessonId, Math.round(activeSeconds));
    };
  }, [lessonId, module]);
}
