"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2, RefreshCw, Loader2 } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import type { MasteryLevel } from "@/types";
import type { VocabularyItem } from "@/types/content";

type VocabularyViewItem = VocabularyItem & {
  mastery?: MasteryLevel;
};

export default function VocabularyPage() {
  const { currentLesson } = useModulePage("vocabulary");
  useStudySession("vocabulary", currentLesson);

  const [words, setWords] = useState<VocabularyViewItem[]>([]);
  const [showReading, setShowReading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"cache" | "ai" | null>(null);

  const loadWords = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");

      try {
        const response = await getModuleContent({
          lessonId: currentLesson,
          module: "vocabulary",
          forceRefresh,
        });
        const masteryMap = await getMasteryMap(currentLesson, "vocabulary");
        const nextWords = response.data.map((word) => ({
          ...word,
          mastery: masteryMap[word.word] as MasteryLevel | undefined,
        }));

        setWords(nextWords);
        setSource(response.source);
        await syncLearningProgress(
          currentLesson,
          "vocabulary",
          response.data,
          masteryMap
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "单词内容加载失败。");
      } finally {
        setLoading(false);
      }
    },
    [currentLesson]
  );

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  const handleMastery = async (index: number, level: MasteryLevel) => {
    const word = words[index];
    if (!word) return;

    const nextWords = words.map((item, itemIndex) =>
      itemIndex === index ? { ...item, mastery: level } : item
    );
    setWords(nextWords);

    await saveMastery(currentLesson, "vocabulary", word.word, level);
    const masteryMap = await getMasteryMap(currentLesson, "vocabulary");
    await syncLearningProgress(
      currentLesson,
      "vocabulary",
      nextWords.map(({ mastery, ...item }) => item),
      masteryMap
    );
  };

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.8;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div>
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
            {source && (
              <span className="ml-2">
                · {source === "cache" ? "缓存内容" : "AI 生成"}
              </span>
            )}
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
            onClick={() => void loadWords(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border text-text-secondary
                       hover:border-primary/40 hover:text-primary transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
          <p>{error}</p>
          <button
            onClick={() => void loadWords(true)}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {words.map((word, index) => (
            <div
              key={`${word.word}-${index}`}
              className="bg-bg-card border border-border rounded-xl p-4
                         hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-medium text-text">
                      {word.word}
                    </span>
                    {showReading && (
                      <span className="text-sm text-primary">{word.reading}</span>
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
                  onChange={(level) => void handleMastery(index, level)}
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
