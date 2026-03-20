"use client";

import { useState, useRef, useCallback } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInputBarProps {
  onSend: (message: string) => void;
  loading?: boolean;
}

export default function AIInputBar({ onSend, loading }: AIInputBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, loading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="border-t border-border bg-bg-card px-4 py-3 shrink-0">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="跟 AI 老师说：练第 2 课语法 / 出 5 道单词题…"
          rows={1}
          className={cn(
            "flex-1 resize-none bg-bg border border-border rounded-xl px-4 py-2.5",
            "text-sm text-text placeholder:text-text-muted",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "transition-colors"
          )}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className={cn(
            "p-2.5 rounded-xl transition-colors shrink-0",
            input.trim() && !loading
              ? "bg-primary text-white hover:bg-primary-dark"
              : "bg-border/50 text-text-muted cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <SendHorizontal size={18} />
          )}
        </button>
      </div>
      <div className="flex gap-2 mt-2 max-w-3xl mx-auto">
        {["练单词", "练语法", "出 5 道题", "复习薄弱"].map((hint) => (
          <button
            key={hint}
            onClick={() => {
              setInput(hint);
              textareaRef.current?.focus();
            }}
            className="text-[11px] px-2.5 py-1 rounded-full border border-border
                       text-text-muted hover:text-primary hover:border-primary/40
                       transition-colors"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}
