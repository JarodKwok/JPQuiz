"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import ModuleQuizPanel from "@/components/quiz/ModuleQuizPanel";
import ModuleModeTabs from "@/components/quiz/ModuleModeTabs";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import { speak, speakAll } from "@/services/audio";
import type { MasteryLevel } from "@/types";
import type { TextContent } from "@/types/content";

export default function TextPage() {
  const { currentLesson } = useModulePage("text");
  useStudySession("text", currentLesson);

  const [textData, setTextData] = useState<TextContent | null>(null);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [showTranslation, setShowTranslation] = useState(true);
  const [mastery, setMastery] = useState<MasteryLevel | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"builtin" | "cache" | "ai" | null>(null);

  const masteryItemKey = `text:${currentLesson}`;

  const loadText = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");

      try {
        const response = await getModuleContent({
          lessonId: currentLesson,
          module: "text",
          forceRefresh,
        });
        const masteryMap = await getMasteryMap(currentLesson, "text");

        setTextData(response.data);
        setMastery(masteryMap[masteryItemKey] as MasteryLevel | undefined);
        setSource(response.source);
        await syncLearningProgress(currentLesson, "text", response.data, masteryMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "课文内容加载失败。");
      } finally {
        setLoading(false);
      }
    },
    [currentLesson, masteryItemKey]
  );

  useEffect(() => {
    void loadText();
  }, [loadText]);

  const playLine = (text: string, index: number) => {
    void speak(text, currentLesson, "text", index);
  };

  const playAll = () => {
    if (!textData) return;
    void speakAll(
      textData.lines.map((line, i) => ({
        text: line.japanese,
        lessonId: currentLesson,
        type: "text" as const,
        index: i,
      }))
    );
  };

  const handleMastery = async (level: MasteryLevel) => {
    if (!textData) return;

    setMastery(level);
    await saveMastery(currentLesson, "text", masteryItemKey, level);
    const masteryMap = await getMasteryMap(currentLesson, "text");
    await syncLearningProgress(currentLesson, "text", textData, masteryMap);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text">
            课文学习
            <span className="text-text-muted font-normal ml-2 text-sm">
              ほんぶん
            </span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            第 {currentLesson} 課
            {textData?.title ? ` · ${textData.title}` : ""}
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
              onClick={() => setShowTranslation(!showTranslation)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                         text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              {showTranslation ? <EyeOff size={14} /> : <Eye size={14} />}
              {showTranslation ? "隐藏翻译" : "显示翻译"}
            </button>
            <button
              onClick={playAll}
              disabled={!textData}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                         text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Volume2 size={14} />
              朗读全文
            </button>
            <button
              onClick={() => void loadText(true)}
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
            onClick={() => void loadText(true)}
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
          module="text"
          lessonId={currentLesson}
          content={textData}
          contentLoading={loading}
          contentError={error}
        />
      ) : (
        <>
          {!loading && error && (
            <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-secondary">
              <p>{error}</p>
              <button
                onClick={() => void loadText(true)}
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

          {!loading && !error && textData && (
            <div className="space-y-4">
              <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-text">这篇课文掌握得怎么样？</p>
                  <p className="text-xs text-text-muted mt-1">
                    标记后会同步更新进度与薄弱项统计
                  </p>
                </div>
                <MasteryButtons
                  current={mastery}
                  onChange={(level) => void handleMastery(level)}
                  size="sm"
                />
              </div>

              <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
                {textData.lines.map((line, index) => (
                  <div
                    key={`${line.japanese}-${index}`}
                    className="px-4 py-3 flex items-start gap-3 hover:bg-bg-sidebar/30 transition-colors group"
                  >
                    <button
                      onClick={() => playLine(line.japanese, index)}
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
                      {line.notes && (
                        <p className="text-[11px] text-primary mt-1">{line.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
