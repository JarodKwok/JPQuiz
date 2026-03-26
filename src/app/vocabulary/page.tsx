"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2, RefreshCw, Loader2, Eye, EyeOff, Hash, Languages } from "lucide-react";
import MasteryButtons from "@/components/lesson/MasteryButtons";
import ModuleQuizPanel from "@/components/quiz/ModuleQuizPanel";
import ModuleModeTabs from "@/components/quiz/ModuleModeTabs";
import { useModulePage } from "@/hooks/useModulePage";
import { useStudySession } from "@/hooks/useStudySession";
import { getModuleContent } from "@/services/content";
import { getMasteryMap, saveMastery } from "@/services/mastery";
import { syncLearningProgress } from "@/services/progress";
import type { MasteryLevel } from "@/types";
import type { VocabularyItem } from "@/types/content";

type VocabularyViewItem = VocabularyItem & {
  mastery?: MasteryLevel;
  showMeaning?: boolean;
  showKanji?: boolean;
};

export default function VocabularyPage() {
  const { currentLesson } = useModulePage("vocabulary");
  useStudySession("vocabulary", currentLesson);

  const [words, setWords] = useState<VocabularyViewItem[]>([]);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [showNumbers, setShowNumbers] = useState(true);
  const [showMeaningGlobal, setShowMeaningGlobal] = useState(true);
  const [showKanjiGlobal, setShowKanjiGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"builtin" | "cache" | "ai" | null>(null);

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
          showMeaning: true,
          showKanji: false,
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

  // 当全局中文开关变化时，更新所有单词
  useEffect(() => {
    setWords((prev) =>
      prev.map((word) => ({ ...word, showMeaning: showMeaningGlobal }))
    );
  }, [showMeaningGlobal]);

  // 当全局汉字开关变化时，更新所有单词
  useEffect(() => {
    setWords((prev) =>
      prev.map((word) => ({ ...word, showKanji: showKanjiGlobal }))
    );
  }, [showKanjiGlobal]);

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
      nextWords.map(({ mastery, showMeaning, showKanji, ...item }) => item),
      masteryMap
    );
  };

  const toggleWordMeaning = (index: number) => {
    setWords((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, showMeaning: !item.showMeaning } : item
      )
    );
  };

  const toggleWordKanji = (index: number) => {
    setWords((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, showKanji: !item.showKanji } : item
      )
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

  // 计算有汉字的单词数量
  const kanjiCount = words.filter(w => w.kanji).length;

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
            {kanjiCount > 0 && ` · ${kanjiCount} 个含汉字`}
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
            {/* 汉字开关（仅当有汉字单词时显示） */}
            {kanjiCount > 0 && (
              <button
                onClick={() => setShowKanjiGlobal(!showKanjiGlobal)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showKanjiGlobal
                    ? "border-accent text-accent bg-accent/5"
                    : "border-border text-text-secondary hover:border-accent/40 hover:text-accent"
                }`}
                title={showKanjiGlobal ? "隐藏汉字" : "显示汉字"}
              >
                <Languages size={14} />
                汉字
              </button>
            )}
            {/* 中文开关 */}
            <button
              onClick={() => setShowMeaningGlobal(!showMeaningGlobal)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showMeaningGlobal
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
              }`}
            >
              {showMeaningGlobal ? <Eye size={14} /> : <EyeOff size={14} />}
              中文
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
        ) : (
          <button
            onClick={() => void loadWords(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border text-text-secondary
                       hover:border-primary/40 hover:text-primary transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <div className="mb-6">
        <ModuleModeTabs mode={mode} onChange={setMode} />
      </div>

      {mode === "quiz" ? (
        <ModuleQuizPanel
          module="vocabulary"
          lessonId={currentLesson}
          content={words.map(({ mastery, showMeaning, showKanji, ...item }) => item)}
          contentLoading={loading}
          contentError={error}
        />
      ) : (
        <>
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
                      {/* 第一行：序号 + 假名 + [汉字] + 发音按钮 */}
                      <div className="flex items-center gap-3">
                        {/* 序号 */}
                        {showNumbers && (
                          <span className="text-xs text-text-muted w-6 text-right shrink-0">
                            {index + 1}.
                          </span>
                        )}
                        {/* 主文本（假名） */}
                        <span className="text-xl font-medium text-text">
                          {word.word}
                        </span>
                        {/* 汉字（如果有且开启显示） */}
                        {word.kanji && word.showKanji && (
                          <span className="text-xl font-medium text-accent bg-accent/5 px-2 py-0.5 rounded">
                            {word.kanji}
                          </span>
                        )}
                        {/* 发音按钮 */}
                        <button
                          onClick={() => speak(word.word)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted
                                     hover:text-primary transition-colors"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>
                      
                      {/* 第二行：控制按钮 + 中文释义 */}
                      <div className="flex items-center gap-3 mt-2">
                        {/* 单个单词汉字切换（仅当有汉字时显示） */}
                        {word.kanji && (
                          <button
                            onClick={() => toggleWordKanji(index)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              word.showKanji 
                                ? "bg-accent/10 text-accent" 
                                : "hover:bg-accent/10 text-text-muted hover:text-accent"
                            }`}
                            title={word.showKanji ? "隐藏汉字" : "显示汉字"}
                          >
                            <Languages size={14} />
                          </button>
                        )}
                        {/* 单个单词中文切换 */}
                        <button
                          onClick={() => toggleWordMeaning(index)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted
                                     hover:text-primary transition-colors"
                          title={word.showMeaning ? "隐藏释义" : "显示释义"}
                        >
                          {word.showMeaning ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        {/* 中文释义 */}
                        {word.showMeaning ? (
                          <span className="text-sm text-text-secondary">
                            {word.meaning}
                          </span>
                        ) : (
                          <span className="text-sm text-text-muted italic">
                            [释义已隐藏]
                          </span>
                        )}
                      </div>

                      {/* 例句 */}
                      {word.example && word.showMeaning && (
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
        </>
      )}
    </div>
  );
}
