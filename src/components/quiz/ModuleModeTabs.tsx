"use client";

import { cn } from "@/lib/utils";

interface ModuleModeTabsProps {
  mode: "study" | "quiz";
  onChange: (mode: "study" | "quiz") => void;
}

export default function ModuleModeTabs({
  mode,
  onChange,
}: ModuleModeTabsProps) {
  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-bg-card p-1">
      {[
        { key: "study", label: "学习" },
        { key: "quiz", label: "测验" },
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key as "study" | "quiz")}
          className={cn(
            "px-4 py-2 text-sm rounded-lg transition-colors",
            mode === item.key
              ? "bg-primary text-white shadow-sm"
              : "text-text-secondary hover:text-primary"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
