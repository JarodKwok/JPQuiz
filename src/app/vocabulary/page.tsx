"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2, RefreshCw, Loader2 } from "lucide-react";
import { useLessonStore } from "@/stores/lessonStore";
import { useSettingsStore } from "@/stores/settingsStore";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import { saveMastery, getMasteryMap } from "@/services/mastery";
import type { MasteryLevel } from "@/types";

interface VocabWord {
  word: string;
  reading: string;
  meaning: string;
  example?: string;
  mastery?: MasteryLevel;
}

// Mock data for demo (AI will replace this)
const MOCK_VOCAB: Record<number, VocabWord[]> = {
  1: [
    { word: "わたし", reading: "わたし", meaning: "我", example: "わたしは マイク・ミラーです。" },
    { word: "あなた", reading: "あなた", meaning: "你", example: "あなたは 学生ですか。" },
    { word: "会社員", reading: "かいしゃいん", meaning: "公司职员", example: "わたしは 会社員です。" },
    { word: "学生", reading: "がくせい", meaning: "学生", example: "カリナさんは 学生です。" },
    { word: "先生", reading: "せんせい", meaning: "老师", example: "ワット先生は IMC の先生です。" },
    { word: "大学", reading: "だいがく", meaning: "大学", example: "富士大学の 学生です。" },
    { word: "病院", reading: "びょういん", meaning: "医院", example: "病院の 先生です。" },
    { word: "電話", reading: "でんわ", meaning: "电话", example: "電話番号は 何番ですか。" },
  ],
  2: [
    { word: "これ", reading: "これ", meaning: "这个", example: "これは 本です。" },
    { word: "それ", reading: "それ", meaning: "那个", example: "それは 辞書ですか。" },
    { word: "あれ", reading: "あれ", meaning: "那个（远处）", example: "あれは テレビです。" },
    { word: "本", reading: "ほん", meaning: "书", example: "これは 日本語の 本です。" },
    { word: "辞書", reading: "じしょ", meaning: "词典", example: "それは 英語の 辞書です。" },
    { word: "雑誌", reading: "ざっし", meaning: "杂志", example: "あれは 雑誌です。" },
    { word: "新聞", reading: "しんぶん", meaning: "报纸", example: "これは 日本語の 新聞です。" },
    { word: "鍵", reading: "かぎ", meaning: "钥匙", example: "これは 何の 鍵ですか。" },
  ],
};

export default function VocabularyPage() {
  const { currentLesson } = useLessonStore();
  const { loadSettings } = useSettingsStore();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [showReading, setShowReading] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadWords = useCallback(async () => {
    setLoading(true);
    const raw = MOCK_VOCAB[currentLesson] || MOCK_VOCAB[1] || [];
    // Load saved mastery from IndexedDB
    const masteryMap = await getMasteryMap(currentLesson, "vocabulary");
    const withMastery = raw.map((w) => ({
      ...w,
      mastery: masteryMap[w.word] as MasteryLevel | undefined,
    }));
    setWords(withMastery);
    setLoading(false);
  }, [currentLesson]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const handleMastery = async (index: number, level: MasteryLevel) => {
    const word = words[index];
    if (!word) return;
    setWords((prev) =>
      prev.map((w, i) => (i === index ? { ...w, mastery: level } : w))
    );
    // Persist to IndexedDB
    await saveMastery(currentLesson, "vocabulary", word.word, level);
  };

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
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            单词学习
            <span className="text-text-muted font-normal ml-2 text-sm">
              たんご
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · {words.length} 个单词
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReading(!showReading)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary
                       hover:border-primary/40 hover:text-primary transition-colors"
          >
            {showReading ? "隐藏读音" : "显示读音"}
          </button>
          <button
            onClick={loadWords}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border text-text-secondary
                       hover:border-primary/40 hover:text-primary transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {/* Word cards */}
      {!loading && (
        <div className="space-y-3">
          {words.map((word, index) => (
            <div
              key={index}
              className="bg-bg-card border border-border rounded-xl p-4
                         hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-medium text-text">
                      {word.word}
                    </span>
                    {showReading && (
                      <span className="text-sm text-primary">
                        {word.reading}
                      </span>
                    )}
                    <button
                      onClick={() => speak(word.word)}
                      className="p-1 rounded hover:bg-primary/10 text-text-muted
                                 hover:text-primary transition-colors"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    {word.meaning}
                  </p>
                  {word.example && (
                    <p className="text-xs text-text-muted mt-2 pl-3 border-l-2 border-border">
                      {word.example}
                    </p>
                  )}
                </div>

                <MasteryButtons
                  current={word.mastery}
                  onChange={(level) => handleMastery(index, level)}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
