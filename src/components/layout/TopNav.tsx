"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLessonStore } from "@/stores/lessonStore";
import { getLessonProgressSummary, getTodayStudyMinutes } from "@/services/progress";
import { subscribeDataUpdated } from "@/services/events";

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentLesson, setCurrentLesson, hydrated } = useLessonStore();
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [progress, setProgress] = useState({
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
    listening: 0,
  });

  const loadStats = useCallback(async () => {
    const [lessonSummary, today] = await Promise.all([
      getLessonProgressSummary(currentLesson),
      getTodayStudyMinutes(),
    ]);

    setProgress({
      vocabulary: lessonSummary.vocabulary,
      grammar: lessonSummary.grammar,
      text: lessonSummary.text,
      examples: lessonSummary.examples,
      listening: lessonSummary.listening,
    });
    setTodayMinutes(today);
  }, [currentLesson]);

  useEffect(() => {
    if (!hydrated) return;

    queueMicrotask(() => {
      void loadStats();
    });
    return subscribeDataUpdated(() => {
      void loadStats();
    });
  }, [hydrated, loadStats]);

  const handleLessonChange = (lesson: number) => {
    setCurrentLesson(lesson);
    const params = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search
    );
    params.set("lesson", String(lesson));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <header className="h-14 border-b border-border bg-bg-card flex items-center px-4 gap-4 shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-border/40 text-text-secondary"
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-text">大家的日语 AI陪练</span>
      </div>

      {/* Lesson selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted hidden sm:inline">课次</span>
        <select
          value={hydrated ? currentLesson : 1}
          onChange={(e) => handleLessonChange(Number(e.target.value))}
          suppressHydrationWarning
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     cursor-pointer"
        >
          {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              第 {n} 課
            </option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-3 text-xs text-text-muted">
        <span>单词 {progress.vocabulary}%</span>
        <span>语法 {progress.grammar}%</span>
        <span>课文 {progress.text}%</span>
        <span>例句 {progress.examples}%</span>
        <span>听力 {progress.listening}%</span>
        <span>今日 {todayMinutes} 分</span>
      </div>

      <Link
        href="/weak-points"
        className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
      >
        复习薄弱
      </Link>
    </header>
  );
}
