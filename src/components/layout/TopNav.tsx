"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const { currentLesson, setCurrentLesson } = useLessonStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-bg-card flex items-center px-4 gap-4 shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-border/40 text-text-secondary"
      >
        <Menu size={20} />
      </button>

      {/* Lesson selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted hidden sm:inline">课次</span>
        <select
          value={mounted ? currentLesson : 1}
          onChange={(e) => setCurrentLesson(Number(e.target.value))}
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

      {/* Progress indicator (placeholder) */}
      <div className="hidden sm:flex items-center gap-3 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-mastered" />
          <span>已掌握</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-fuzzy" />
          <span>模糊</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-weak" />
          <span>薄弱</span>
        </div>
      </div>
    </header>
  );
}
