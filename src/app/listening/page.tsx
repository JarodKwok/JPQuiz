"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";

interface ListeningItem {
  text: string;
  options: string[];
  answer: number;
}

const MOCK_LISTENING: ListeningItem[] = [
  {
    text: "わたしは 学生です。",
    options: ["我是老师。", "我是学生。", "我是公司职员。", "我是医生。"],
    answer: 1,
  },
  {
    text: "これは 日本語の 本ですか。",
    options: ["这是英语的书吗？", "这是日语的书吗？", "那是日语的书。", "这是什么书？"],
    answer: 1,
  },
  {
    text: "田中さんは 会社員じゃ ありません。",
    options: [
      "田中是公司职员。",
      "田中是学生。",
      "田中不是公司职员。",
      "田中不是学生。",
    ],
    answer: 2,
  },
];

export default function ListeningPage() {
  const { currentLesson } = useLessonStore();
  const [items] = useState<ListeningItem[]>(MOCK_LISTENING);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [playing, setPlaying] = useState<number | null>(null);

  const speak = (text: string, index: number) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.7;
      utterance.onend = () => setPlaying(null);
      setPlaying(index);
      speechSynthesis.speak(utterance);
    }
  };

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (revealed[qIndex]) return;
    setSelected((prev) => ({ ...prev, [qIndex]: optIndex }));
    setRevealed((prev) => ({ ...prev, [qIndex]: true }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            听力训练
            <span className="text-text-muted font-normal ml-2 text-sm">
              リスニング
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · 听选答案模式
          </p>
        </div>
        <button
          onClick={() => {
            setSelected({});
            setRevealed({});
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                     text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
        >
          <RotateCcw size={14} />
          重做
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, qIndex) => (
          <div
            key={qIndex}
            className="bg-bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-text-muted font-mono">
                Q{qIndex + 1}
              </span>
              <button
                onClick={() => speak(item.text, qIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
              >
                {playing === qIndex ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
                播放听力
              </button>
              {revealed[qIndex] && (
                <span className="text-xs text-text-muted">
                  {item.text}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {item.options.map((opt, optIndex) => {
                const isSelected = selected[qIndex] === optIndex;
                const isCorrect = item.answer === optIndex;
                const isRevealed = revealed[qIndex];

                let style = "border-border text-text-secondary hover:border-primary/30";
                if (isRevealed && isCorrect) {
                  style = "border-mastered bg-mastered/10 text-mastered";
                } else if (isRevealed && isSelected && !isCorrect) {
                  style = "border-weak bg-weak/10 text-weak";
                }

                return (
                  <button
                    key={optIndex}
                    onClick={() => handleSelect(qIndex, optIndex)}
                    disabled={isRevealed}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${style}`}
                  >
                    <span className="text-xs font-mono mr-2 opacity-50">
                      {String.fromCharCode(65 + optIndex)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
