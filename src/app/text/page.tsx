"use client";

import { useState, useEffect } from "react";
import { Volume2, Eye, EyeOff } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";

interface TextLine {
  japanese: string;
  translation: string;
  notes?: string;
}

const MOCK_TEXT: Record<number, { title: string; lines: TextLine[] }> = {
  1: {
    title: "自己紹介（自我介绍）",
    lines: [
      { japanese: "ミラー：はじめまして。", translation: "米勒：初次见面。" },
      {
        japanese: "ミラー：わたしは マイク・ミラーです。",
        translation: "米勒：我是迈克·米勒。",
      },
      {
        japanese: "ミラー：アメリカから 来ました。",
        translation: "米勒：我从美国来。",
      },
      {
        japanese: "ミラー：どうぞ よろしく お願いします。",
        translation: "米勒：请多关照。",
      },
      {
        japanese: "サントス：わたしは サントスです。",
        translation: "桑托斯：我是桑托斯。",
      },
      {
        japanese: "サントス：ブラジルから 来ました。",
        translation: "桑托斯：我从巴西来。",
      },
      {
        japanese: "サントス：どうぞ よろしく お願いします。",
        translation: "桑托斯：请多关照。",
      },
    ],
  },
  2: {
    title: "買い物（购物）",
    lines: [
      {
        japanese: "ミラー：すみません。それは 何ですか。",
        translation: "米勒：请问，那是什么？",
      },
      {
        japanese: "店員：これですか。これは 携帯電話です。",
        translation: "店员：这个吗？这是手机。",
      },
      {
        japanese: "ミラー：それは ミラーさんのですか。",
        translation: "米勒：那是米勒先生的吗？",
      },
      {
        japanese: "佐藤：いいえ、わたしのじゃ ありません。",
        translation: "佐藤：不，不是我的。",
      },
    ],
  },
};

export default function TextPage() {
  const { currentLesson } = useLessonStore();
  const [textData, setTextData] = useState<{
    title: string;
    lines: TextLine[];
  } | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    setTextData(MOCK_TEXT[currentLesson] || MOCK_TEXT[1] || null);
  }, [currentLesson]);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const speakAll = () => {
    if (!textData) return;
    const fullText = textData.lines.map((l) => l.japanese).join("\n");
    speak(fullText);
  };

  if (!textData) {
    return (
      <div className="text-center py-12 text-text-muted text-sm">
        暂无第 {currentLesson} 課的课文数据
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            课文学习
            <span className="text-text-muted font-normal ml-2 text-sm">
              ほんぶん
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · {textData.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                       text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
          >
            {showTranslation ? <EyeOff size={14} /> : <Eye size={14} />}
            {showTranslation ? "隐藏翻译" : "显示翻译"}
          </button>
          <button
            onClick={speakAll}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                       text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Volume2 size={14} />
            朗读全文
          </button>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
        {textData.lines.map((line, index) => (
          <div
            key={index}
            className="px-4 py-3 flex items-start gap-3 hover:bg-bg-sidebar/30 transition-colors group"
          >
            <button
              onClick={() => speak(line.japanese)}
              className="mt-0.5 p-1 rounded hover:bg-primary/10 text-text-muted
                         hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
            >
              <Volume2 size={14} />
            </button>
            <div className="flex-1">
              <p className="text-sm text-text leading-relaxed">
                {line.japanese}
              </p>
              {showTranslation && (
                <p className="text-xs text-text-secondary mt-1">
                  {line.translation}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
