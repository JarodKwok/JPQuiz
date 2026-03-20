"use client";

import { useState } from "react";
import { RefreshCw, Volume2 } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";

interface ExampleSentence {
  japanese: string;
  reading: string;
  translation: string;
  grammar?: string;
}

const MOCK_EXAMPLES: ExampleSentence[] = [
  {
    japanese: "わたしは 日本語の 学生です。",
    reading: "わたしは にほんごの がくせいです。",
    translation: "我是日语的学生。",
    grammar: "〜は 〜です",
  },
  {
    japanese: "あの 人は だれですか。",
    reading: "あの ひとは だれですか。",
    translation: "那个人是谁？",
    grammar: "〜は 〜ですか",
  },
  {
    japanese: "田中さんは 先生じゃ ありません。",
    reading: "たなかさんは せんせいじゃ ありません。",
    translation: "田中先生不是老师。",
    grammar: "〜じゃ ありません",
  },
  {
    japanese: "これは 日本の 新聞です。",
    reading: "これは にほんの しんぶんです。",
    translation: "这是日本的报纸。",
    grammar: "〜の 〜",
  },
];

export default function ExamplesPage() {
  const { currentLesson } = useLessonStore();
  const [examples] = useState<ExampleSentence[]>(MOCK_EXAMPLES);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            例句练习
            <span className="text-text-muted font-normal ml-2 text-sm">
              れいぶん
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · {examples.length} 个例句
          </p>
        </div>
        <button className="p-1.5 rounded-lg border border-border text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="space-y-3">
        {examples.map((ex, index) => (
          <div
            key={index}
            className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-base text-text">{ex.japanese}</p>
                <p className="text-xs text-primary mt-1">{ex.reading}</p>
                <p className="text-sm text-text-secondary mt-1.5">
                  {ex.translation}
                </p>
                {ex.grammar && (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {ex.grammar}
                  </span>
                )}
              </div>
              <button
                onClick={() => speak(ex.japanese)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
              >
                <Volume2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
