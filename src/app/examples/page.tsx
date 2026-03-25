"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Volume2, Loader2 } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import type { MasteryLevel } from "@/types";
import type { ExampleItem } from "@/types/content";

type ExampleViewItem = ExampleItem & {
  mastery?: MasteryLevel;
};

export default function ExamplesPage() {
  const { currentLesson } = useModulePage("examples");
  useStudySession("examples", currentLesson);

  const [examples, setExamples] = useState<ExampleViewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"cache" | "ai" | null>(null);

  const loadExamples = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");

      try {
        const response = await getModuleContent({
          lessonId: currentLesson,
          module: "examples",
          forceRefresh,
        });
        const masteryMap = await getMasteryMap(currentLesson, "examples");
        const nextExamples = response.data.map((item) => ({
          ...item,
          mastery: masteryMap[item.japanese] as MasteryLevel | undefined,
        }));

        setExamples(nextExamples);
        setSource(response.source);
        await syncLearningProgress(
          currentLesson,
          "examples",
          response.data,
          masteryMap
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "例句内容加载失败。");
      } finally {
        setLoading(false);
      }
    },
    [currentLesson]
  );

  useEffect(() => {
    void loadExamples();
  }, [loadExamples]);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.8;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  };

  const handleMastery = async (index: number, level: MasteryLevel) => {
    const example = examples[index];
    if (!example) return;

    const nextExamples = examples.map((item, itemIndex) =>
      itemIndex === index ? { ...item, mastery: level } : item
    );
    setExamples(nextExamples);

    await saveMastery(currentLesson, "examples", example.japanese, level);
    const masteryMap = await getMasteryMap(currentLesson, "examples");
    await syncLearningProgress(
      currentLesson,
      "examples",
      nextExamples.map(({ mastery, ...item }) => item),
      masteryMap
    );
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
            {source && (
              <span className="ml-2">
                · {source === "cache" ? "缓存内容" : "AI 生成"}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => void loadExamples(true)}
          disabled={loading}
          className="p-1.5 rounded-lg border border-border text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
        </button>
      </div>

      {!loading && error && (
        <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
          <p>{error}</p>
          <button
            onClick={() => void loadExamples(true)}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {examples.map((example, index) => (
            <div
              key={`${example.japanese}-${index}`}
              className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base text-text">{example.japanese}</p>
                      <p className="text-xs text-primary mt-1">
                        {example.reading}
                      </p>
                    </div>
                    <button
                      onClick={() => speak(example.japanese)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary mt-1.5">
                    {example.translation}
                  </p>
                  {example.grammar && (
                    <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {example.grammar}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <MasteryButtons
                  current={example.mastery}
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
