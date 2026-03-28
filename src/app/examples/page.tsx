"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Volume2, Loader2, Hash } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import ModuleQuizPanel from "@/components/quiz/ModuleQuizPanel";
import ModuleModeTabs from "@/components/quiz/ModuleModeTabs";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import { speak } from "@/services/audio";
import type { MasteryLevel } from "@/types";
import type {
  ExampleItem,
  ExamplesContent,
  SentencePatternItem,
} from "@/types/content";

type ExampleViewItem = ExampleItem & {
  mastery?: MasteryLevel;
};

type PatternViewItem = SentencePatternItem & {
  mastery?: MasteryLevel;
};

export default function ExamplesPage() {
  const { currentLesson } = useModulePage("examples");
  useStudySession("examples", currentLesson);

  const [patterns, setPatterns] = useState<PatternViewItem[]>([]);
  const [examples, setExamples] = useState<ExampleViewItem[]>([]);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [showNumbers, setShowNumbers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"builtin" | "cache" | "ai" | null>(
    null
  );

  const getPlainContent = useCallback(
    (
      nextPatterns: PatternViewItem[] = patterns,
      nextExamples: ExampleViewItem[] = examples
    ): ExamplesContent => ({
      patterns: nextPatterns.map(({ mastery, ...item }) => item),
      examples: nextExamples.map(({ mastery, ...item }) => item),
    }),
    [examples, patterns]
  );

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
        const nextPatterns = response.data.patterns.map((item) => ({
          ...item,
          mastery: masteryMap[item.id] as MasteryLevel | undefined,
        }));
        const nextExamples = response.data.examples.map((item) => ({
          ...item,
          mastery: masteryMap[item.japanese] as MasteryLevel | undefined,
        }));

        setPatterns(nextPatterns);
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

  const playPattern = (text: string, index: number) => {
    void speak(text, currentLesson, "pattern", index);
  };

  const playExample = (text: string, index: number) => {
    void speak(text, currentLesson, "example", index);
  };

  const handlePatternMastery = async (index: number, level: MasteryLevel) => {
    const pattern = patterns[index];
    if (!pattern) return;

    const nextPatterns = patterns.map((item, itemIndex) =>
      itemIndex === index ? { ...item, mastery: level } : item
    );
    setPatterns(nextPatterns);

    await saveMastery(currentLesson, "examples", pattern.id, level);
    const masteryMap = await getMasteryMap(currentLesson, "examples");
    await syncLearningProgress(
      currentLesson,
      "examples",
      getPlainContent(nextPatterns, examples),
      masteryMap
    );
  };

  const handleExampleMastery = async (index: number, level: MasteryLevel) => {
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
      getPlainContent(patterns, nextExamples),
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
            第 {currentLesson} 課 · {patterns.length} 个句型 · {examples.length} 个例句
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
        ) : (
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
        )}
      </div>

      <div className="mb-6">
        <ModuleModeTabs mode={mode} onChange={setMode} />
      </div>

      {mode === "quiz" ? (
        <ModuleQuizPanel
          module="examples"
          lessonId={currentLesson}
          content={getPlainContent()}
          contentLoading={loading}
          contentError={error}
        />
      ) : (
        <>
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
            <div className="space-y-6">
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-text">核心句型</h2>
                  <span className="text-[11px] text-text-muted">
                    建议先掌握句型，再看应用例句
                  </span>
                </div>
                <div className="space-y-3">
                  {patterns.map((pattern, index) => (
                    <div
                      key={pattern.id}
                      className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 序号 */}
                            {showNumbers && (
                              <span className="text-xs text-text-muted w-5 text-right shrink-0">
                                {index + 1}.
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {pattern.id}
                            </span>
                            <p className="text-base font-medium text-text">
                              {pattern.pattern}
                            </p>
                          </div>
                          <p className="text-sm text-text-secondary mt-1">
                            {pattern.meaning}
                          </p>
                          <p className="text-xs text-text-muted mt-2">
                            结构：{pattern.structure}
                          </p>
                          <div className="mt-3 rounded-lg bg-bg px-3 py-2 border border-border/70">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-text">
                                  {pattern.sampleJapanese}
                                </p>
                                <p className="text-xs text-primary mt-1">
                                  {pattern.sampleReading}
                                </p>
                                <p className="text-xs text-text-secondary mt-1">
                                  {pattern.sampleTranslation}
                                </p>
                              </div>
                              <button
                                onClick={() => playPattern(pattern.sampleJapanese, index)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                          </div>
                          {pattern.notes && (
                            <p className="text-xs text-text-muted mt-2">
                              {pattern.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <MasteryButtons
                          current={pattern.mastery}
                          onChange={(level) =>
                            void handlePatternMastery(index, level)
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-text">应用例句</h2>
                  <span className="text-[11px] text-text-muted">
                    句型在真实语境中的使用
                  </span>
                </div>
                <div className="space-y-3">
                  {examples.map((example, index) => (
                    <div
                      key={`${example.japanese}-${index}`}
                      className="bg-bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2">
                              {/* 序号 */}
                              {showNumbers && (
                                <span className="text-xs text-text-muted w-5 text-right shrink-0 mt-1">
                                  {index + 1}.
                                </span>
                              )}
                              <div>
                                <p className="text-base text-text">
                                  {example.japanese}
                                </p>
                                <p className="text-xs text-primary mt-1">
                                  {example.reading}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => playExample(example.japanese, index)}
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
                          onChange={(level) =>
                            void handleExampleMastery(index, level)
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
