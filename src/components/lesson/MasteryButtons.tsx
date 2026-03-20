"use client";

import { cn } from "@/lib/utils";
import type { MasteryLevel } from "@/types";

interface MasteryButtonsProps {
  current?: MasteryLevel;
  onChange: (level: MasteryLevel) => void;
  size?: "sm" | "md";
}

const buttons: { level: MasteryLevel; label: string; color: string }[] = [
  { level: "mastered", label: "会了", color: "bg-mastered/15 text-mastered border-mastered/30 hover:bg-mastered/25" },
  { level: "fuzzy", label: "模糊", color: "bg-fuzzy/15 text-fuzzy border-fuzzy/30 hover:bg-fuzzy/25" },
  { level: "weak", label: "不会", color: "bg-weak/15 text-weak border-weak/30 hover:bg-weak/25" },
];

export default function MasteryButtons({
  current,
  onChange,
  size = "md",
}: MasteryButtonsProps) {
  return (
    <div className="flex gap-2">
      {buttons.map(({ level, label, color }) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={cn(
            "rounded-lg border font-medium transition-all",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
            current === level
              ? cn(color, "ring-2 ring-offset-1",
                  level === "mastered" && "ring-mastered/40",
                  level === "fuzzy" && "ring-fuzzy/40",
                  level === "weak" && "ring-weak/40"
                )
              : "border-border text-text-muted hover:border-border"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
