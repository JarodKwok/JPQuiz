"use client";

import { useState, useRef, useCallback } from "react";
import { Check, X, CornerDownLeft } from "lucide-react";

interface PracticeInputProps {
  /** The correct answer(s) — word (hiragana), and optionally kanji */
  word: string;
  kanji?: string;
  /** Called when auto-check determines mastery */
  onAutoCheck: (correct: boolean) => void;
}

/** Normalize text for comparison: NFKC, trim, remove punctuation/spaces */
function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .replace(/[\s　。．.、，,：:～〜\-ー－]/g, "")
    .toLowerCase();
}

export default function PracticeInput({
  word,
  kanji,
  onAutoCheck,
}: PracticeInputProps) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCheck = useCallback(() => {
    if (!value.trim()) return;

    const input = normalize(value);
    const targets = [normalize(word)];
    if (kanji) targets.push(normalize(kanji));

    const correct = targets.some((t) => t === input);
    setResult(correct ? "correct" : "wrong");
    onAutoCheck(correct);
  }, [value, word, kanji, onAutoCheck]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME 输入中（日语候选确认等）不触发判断
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (result) {
        setValue("");
        setResult(null);
        return;
      }
      handleCheck();
    }
  };

  const handleReset = () => {
    setValue("");
    setResult(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="relative flex-1 max-w-[220px]">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (result) setResult(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="听写练习…"
          disabled={false}
          className={`w-full text-sm px-3 py-1.5 rounded-lg border outline-none transition-colors ${
            result === "correct"
              ? "border-mastered bg-mastered/5 text-mastered"
              : result === "wrong"
                ? "border-weak bg-weak/5 text-weak"
                : "border-border bg-bg text-text focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          }`}
        />
        {!result && value.trim() && (
          <button
            onClick={handleCheck}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-primary transition-colors"
            title="检查 (Enter)"
          >
            <CornerDownLeft size={14} />
          </button>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-1.5">
          {result === "correct" ? (
            <span className="flex items-center gap-1 text-xs text-mastered font-medium">
              <Check size={14} />
              正确
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-weak font-medium">
              <X size={14} />
              {word}
            </span>
          )}
          <button
            onClick={handleReset}
            className="text-[10px] text-text-muted hover:text-primary underline underline-offset-2 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
