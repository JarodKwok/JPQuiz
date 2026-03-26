"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, RotateCcw, RefreshCw, Loader2 } from "lucide-react";
import ModuleQuizPanel from "@/components/quiz/ModuleQuizPanel";
import ModuleModeTabs from "@/components/quiz/ModuleModeTabs";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import { saveWrongAnswer } from "@/services/wrongAnswers";
import type { ListeningItem } from "@/types/content";

export default function ListeningPage() {
  const { currentLesson } = useModulePage("listening");
  useStudySession("listening", currentLesson);

  const [items, setItems] = useState<ListeningItem[]>([]);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [playing, setPlaying] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"builtin" | "cache" | "ai" | null>(null);

  const loadItems = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");

      try {
        const response = await getModuleContent({
          lessonId: currentLesson,
          module: "listening",
          forceRefresh,
        });
        const masteryMap = await getMasteryMap(currentLesson, "listening");

        setItems(response.data);
        setSelected({});
        setRevealed({});
        setSource(response.source);
        await syncLearningProgress(
          currentLesson,
          "listening",
          response.data,
          masteryMap
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "听力内容加载失败。");
      } finally {
        setLoading(false);
      }
    },
    [currentLesson]
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

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

  const handleSelect = async (questionIndex: number, optionIndex: number) => {
    if (revealed[questionIndex]) return;

    const item = items[questionIndex];
    if (!item) return;

    const isCorrect = item.answer === optionIndex;
    const itemKey = `listening:${currentLesson}:${questionIndex}:${item.text}`;

    setSelected((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    setRevealed((prev) => ({ ...prev, [questionIndex]: true }));

    await saveMastery(
      currentLesson,
      "listening",
      itemKey,
      isCorrect ? "mastered" : "weak"
    );

    if (!isCorrect) {
      await saveWrongAnswer({
        lessonId: currentLesson,
        module: "listening",
        question: item.text,
        userAnswer: item.options[optionIndex],
        correctAnswer: item.options[item.answer] || "",
      });
    }

    const masteryMap = await getMasteryMap(currentLesson, "listening");
    await syncLearningProgress(currentLesson, "listening", items, masteryMap);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">
            听力训练
            <span className="text-text-muted font-normal ml-2 text-sm">
              リスニング
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · 听选答案模式
            {source && (
              <span className="ml-2">
                ·{" "}
                {source === "builtin"
                  ? "内置内容"
                  : source === "cache"
                    ? "缓存内容"
                    : "AI 生成"}
              </span>
            )}
          </p>
        </div>
        {mode === "study" ? (
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => void loadItems(true)}
              disabled={loading}
              className="p-1.5 rounded-lg border border-border text-text-secondary
                         hover:border-primary/40 hover:text-primary transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={() => void loadItems(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border text-text-secondary
                       hover:border-primary/40 hover:text-primary transition-colors"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        )}
      </div>

      <div className="mb-6">
        <ModuleModeTabs mode={mode} onChange={setMode} />
      </div>

      {mode === "quiz" ? (
        <ModuleQuizPanel
          module="listening"
          lessonId={currentLesson}
          content={items}
          contentLoading={loading}
          contentError={error}
        />
      ) : (
        <>
          {!loading && error && (
            <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
              <p>{error}</p>
              <button
                onClick={() => void loadItems(true)}
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
            <div className="space-y-4">
              {items.map((item, questionIndex) => (
                <div
                  key={`${item.text}-${questionIndex}`}
                  className="bg-bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-text-muted font-mono">
                      Q{questionIndex + 1}
                    </span>
                    <button
                      onClick={() => speak(item.text, questionIndex)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                    >
                      <Play size={14} />
                      {playing === questionIndex ? "重新播放中" : "播放/重播"}
                    </button>
                    {revealed[questionIndex] && (
                      <span className="text-xs text-text-muted">{item.text}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {item.options.map((option, optionIndex) => {
                      const isSelected = selected[questionIndex] === optionIndex;
                      const isCorrect = item.answer === optionIndex;
                      const isRevealed = revealed[questionIndex];

                      let style =
                        "border-border text-text-secondary hover:border-primary/30";
                      if (isRevealed && isCorrect) {
                        style = "border-mastered bg-mastered/10 text-mastered";
                      } else if (isRevealed && isSelected && !isCorrect) {
                        style = "border-weak bg-weak/10 text-weak";
                      }

                      return (
                        <button
                          key={`${option}-${optionIndex}`}
                          onClick={() => void handleSelect(questionIndex, optionIndex)}
                          disabled={isRevealed}
                          className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${style}`}
                        >
                          <span className="text-xs font-mono mr-2 opacity-50">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
