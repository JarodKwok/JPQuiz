"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Module } from "@/types";
import { getCurrentUserId } from "@/services/account";
import { useAccountStore } from "@/stores/accountStore";

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
  const { hydrated, hydrate } = useAccountStore();

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
      return;
    }

    // admin 也走前台默认入口；进后台靠 sidebar 的「进入管理后台」按钮
    const userId = getCurrentUserId();
    const lsGet = (key: string) =>
      localStorage.getItem(`jpquiz-${userId}-${key}`) ??
      localStorage.getItem(`jpquiz-${key}`);
    const lesson = normalizeLesson(lsGet("current-lesson"));
    const moduleName = normalizeModule(lsGet("current-module"));

    router.replace(`/${moduleName}?lesson=${lesson}`);
  }, [router, hydrated]);

  return null;
}
