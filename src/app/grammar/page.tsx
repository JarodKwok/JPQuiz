"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Hash } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import ModuleQuizPanel from "@/components/quiz/ModuleQuizPanel";
import ModuleModeTabs from "@/components/quiz/ModuleModeTabs";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import type { MasteryLevel } from "@/types";
import type { GrammarItem } from "@/types/content";
import { cn } from "@/lib/utils";

type GrammarViewItem = GrammarItem & {
  mastery?: MasteryLevel;
};

export default function GrammarPage() {
  const { currentLesson } = useModulePage("grammar");
  useStudySession("grammar", currentLesson);

  const [points, setPoints] = useState<GrammarViewItem[]>([]);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"builtin" | "cache" | "ai" | null>(null);

  const loadPoints = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");

      try {
        const response = await getModuleContent({
          lessonId: currentLesson,
          module: "grammar",
          forceRefresh,
        });
        const masteryMap = await getMasteryMap(currentLesson, "grammar");
        const nextPoints = response.data.map((point) => ({
          ...point,
          mastery: masteryMap[point.id] as MasteryLevel | undefined,
        }));

        setPoints(nextPoints);
        setExpandedId(null);
        setSource(response.source);
        await syncLearningProgress(
          currentLesson,
          "grammar",
          response.data,
          masteryMap
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "语法内容加载失败。");
      } finally {
        setLoading(false);
      }
    },
    [currentLesson]
  );

  useEffect(() => {
    void loadPoints();
  }, [loadPoints]);

  const handleMastery = async (id: string, level: MasteryLevel) => {
    const nextPoints = points.map((point) =>
      point.id === id ? { ...point, mastery: level } : point
    );
    setPoints(nextPoints);

    await saveMastery(currentLesson, "grammar", id, level);
    const masteryMap = await getMasteryMap(currentLesson, "grammar");
    await syncLearningProgress(
      currentLesson,
      "grammar",
      nextPoints.map(({ mastery, ...point }) => point),
      masteryMap
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">
            语法精讲
            <span className="text-text-muted font-normal ml-2 text-sm">
              ぶんぽう
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課 · {points.length} 个语法点
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
            {/* 序号开关 */}
            <button
              onClick={() => setShowNumbers(!showNumbers)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showNumbers
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
              }`}
              title={showNumbers ? "隐藏序号" : "显示序号"}
            >
              <Hash size={14} />
              序号
            </button>
            <button
              onClick={() => void loadPoints(true)}
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
            onClick={() => void loadPoints(true)}
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
          module="grammar"
          lessonId={currentLesson}
          content={points.map(({ mastery, ...item }) => item)}
          contentLoading={loading}
          contentError={error}
        />
      ) : (
        <>
          {!loading && error && (
            <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
              <p>{error}</p>
              <button
                onClick={() => void loadPoints(true)}
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
              {points.map((point, index) => {
                const isExpanded = expandedId === point.id;

                return (
                  <div
                    key={point.id}
                    className="bg-bg-card border border-border rounded-xl overflow-hidden
                               hover:border-primary/20 transition-colors"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : point.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-primary shrink-0" />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="text-text-muted shrink-0"
                        />
                      )}
                      {/* 序号 */}
                      {showNumbers && (
                        <span className="text-xs text-text-muted w-6 text-right shrink-0">
                          {index + 1}.
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted font-mono">
                            {point.id}
                          </span>
                          <span className="font-medium text-text text-sm">
                            {point.name}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {point.meaning}
                        </p>
                      </div>
                    </button>

                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-200",
                        isExpanded ? "max-h-[32rem]" : "max-h-0"
                      )}
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        <div>
                          <span className="text-[11px] text-text-muted uppercase tracking-wider">
                            接续方式
                          </span>
                          <p className="text-sm text-text mt-1 font-mono bg-bg rounded-lg px-3 py-2">
                            {point.connection}
                          </p>
                        </div>

                        <div>
                          <span className="text-[11px] text-text-muted uppercase tracking-wider">
                            例句
                          </span>
                          <p className="text-sm text-text mt-1">{point.example}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {point.exampleTranslation}
                          </p>
                        </div>

                        {point.tip && (
                          <div className="bg-accent-light/20 rounded-lg px-3 py-2">
                            <span className="text-[11px] text-accent font-medium">
                              注意
                            </span>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {point.tip}
                            </p>
                          </div>
                        )}

                        <MasteryButtons
                          current={point.mastery}
                          onChange={(level) => void handleMastery(point.id, level)}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
