"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Module } from "@/types";
import { useLessonStore } from "@/stores/lessonStore";

export function normalizeLesson(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
    return null;
  }
  return parsed;
}

export function useModulePage(module: Module) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentLesson, setCurrentLesson, setCurrentModule } = useLessonStore();

  useEffect(() => {
    setCurrentModule(module);
  }, [module, setCurrentModule]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncLessonFromQuery = () => {
      const params = new URLSearchParams(window.location.search);
      const lessonFromQuery = normalizeLesson(params.get("lesson"));
      const activeLesson = useLessonStore.getState().currentLesson;

      if (lessonFromQuery) {
        if (lessonFromQuery !== activeLesson) {
          setCurrentLesson(lessonFromQuery);
        }
        return;
      }

      params.set("lesson", String(activeLesson));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    syncLessonFromQuery();
    window.addEventListener("popstate", syncLessonFromQuery);

    return () => {
      window.removeEventListener("popstate", syncLessonFromQuery);
    };
  }, [pathname, router, setCurrentLesson]);

  return { currentLesson };
}
