"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Module } from "@/types";

function normalizeLesson(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
    return 1;
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
  return "vocabulary";
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const lesson =
      typeof window === "undefined"
        ? 1
        : normalizeLesson(localStorage.getItem("jpquiz-current-lesson"));
    const moduleName =
      typeof window === "undefined"
        ? "vocabulary"
        : normalizeModule(localStorage.getItem("jpquiz-current-module"));

    router.replace(`/${moduleName}?lesson=${lesson}`);
  }, [router]);

  return null;
}
