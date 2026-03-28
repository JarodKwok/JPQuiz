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
import { speak, playVictory } from "@/services/audio";
import type { MasteryLevel } from "@/types";
import type { VocabularyItem } from "@/types/content";

type VocabularyViewItem = VocabularyItem & {
  mastery?: MasteryLevel;
  showMeaning?: boolean;
  showKanji?: boolean;
};

type FilterMode = "all" | "weak" | "fuzzy" | "unlearned";

export default function VocabularyPage() {
  const { currentLesson } = useModulePage("vocabulary");
  useStudySession("vocabulary", currentLesson);

  const [words, setWords] = useState<VocabularyViewItem[]>([]);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [showNumbers, setShowNumbers] = useState(true);
  const [showMeaningGlobal, setShowMeaningGlobal] = useState(true);
  const [showKanjiGlobal, setShowKanjiGlobal] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
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

  // 课次切换时重置筛选
  useEffect(() => {
    setFilter("all");
  }, [currentLesson]);

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

  const handleMastery = async (wordIndex: number, level: MasteryLevel) => {
    const word = words[wordIndex];
    if (!word) return;

    const prevAllMastered = words.every((w) => w.mastery === "mastered");

    const nextWords = words.map((item, i) =>
      i === wordIndex ? { ...item, mastery: level } : item
    );
    setWords(nextWords);

    await saveMastery(currentLesson, "vocabulary", word.word, level);
    const masteryMap = await getMasteryMap(currentLesson, "vocabulary");
    const percent = await syncLearningProgress(
      currentLesson,
      "vocabulary",
      nextWords.map(({ mastery, showMeaning, showKanji, ...item }) => item),
      masteryMap
    );

    // 首次达到 100% 时播放胜利音效
    if (percent === 100 && !prevAllMastered) {
      playVictory();
    }
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

  const playWord = (text: string, wordIndex: number) => {
    void speak(text, currentLesson, "vocab", wordIndex);
  };

  // 统计各筛选数量
  const kanjiCount = words.filter((w) => w.kanji).length;
  const weakCount = words.filter((w) => w.mastery === "weak").length;
  const fuzzyCount = words.filter((w) => w.mastery === "fuzzy").length;
  const unlearnedCount = words.filter(
    (w) => w.mastery === "weak" || w.mastery === "fuzzy" || !w.mastery
  ).length;

  // 筛选后的单词列表（保留原始索引用于音频）
  const filteredWords = words
    .map((word, originalIndex) => ({ word, originalIndex }))
    .filter(({ word }) => {
      if (filter === "all") return true;
      if (filter === "weak") return word.mastery === "weak";
      if (filter === "fuzzy") return word.mastery === "fuzzy";
      if (filter === "unlearned")
        return word.mastery === "weak" || word.mastery === "fuzzy" || !word.mastery;
      return true;
    });

  const filterLabel: Record<FilterMode, string> = {
    all: "全部",
    weak: "不会",
    fuzzy: "模糊",
    unlearned: "待复习",
  };

  return (
    <div>
      {/* 悬浮工具栏 */}
      <div className="sticky top-0 z-10 bg-bg -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 pt-1 border-b border-border/50 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">
              单词学习
              <span className="text-text-muted font-normal ml-2 text-sm">
                たんご
              </span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
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
              {/* 汉字开关 */}
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
              {/* 刷新 */}
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

        {/* 筛选 chips（仅学习模式显示） */}
        {mode === "study" && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(
              [
                { key: "all", label: "全部", count: words.length },
                { key: "unlearned", label: "待复习", count: unlearnedCount },
                { key: "weak", label: "不会", count: weakCount },
                { key: "fuzzy", label: "模糊", count: fuzzyCount },
              ] as { key: FilterMode; label: string; count: number }[]
            ).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  filter === key
                    ? key === "weak"
                      ? "border-weak text-weak bg-weak/10"
                      : key === "fuzzy"
                        ? "border-fuzzy text-fuzzy bg-fuzzy/10"
                        : "border-primary text-primary bg-primary/10"
                    : "border-border text-text-muted hover:border-border/80 hover:text-text-secondary"
                }`}
              >
                {label}
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                  filter === key ? "bg-current/10" : "bg-border/50"
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
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
            <>
              {/* 筛选提示条 */}
              {filter !== "all" && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                  <span>
                    当前仅显示 <strong>{filteredWords.length}</strong> 个「{filterLabel[filter]}」单词
                  </span>
                  <button
                    onClick={() => setFilter("all")}
                    className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    显示全部
                  </button>
                </div>
              )}

              {/* 空状态 */}
              {filteredWords.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  没有「{filterLabel[filter]}」的单词
                  <button
                    onClick={() => setFilter("all")}
                    className="block mx-auto mt-2 text-xs text-primary underline underline-offset-2"
                  >
                    显示全部
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredWords.map(({ word, originalIndex }) => (
                    <div
                      key={`${word.word}-${originalIndex}`}
                      className="bg-bg-card border border-border rounded-xl p-4
                                 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {/* 第一行：序号 + 假名 + [汉字] + 发音按钮 */}
                          <div className="flex items-center gap-3">
                            {showNumbers && (
                              <span className="text-xs text-text-muted w-6 text-right shrink-0">
                                {originalIndex + 1}.
                              </span>
                            )}
                            <span className="text-xl font-medium text-text">
                              {word.word}
                            </span>
                            {word.kanji && word.showKanji && (
                              <span className="text-xl font-medium text-accent bg-accent/5 px-2 py-0.5 rounded">
                                {word.kanji}
                              </span>
                            )}
                            <button
                              onClick={() => playWord(word.word, originalIndex)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted
                                         hover:text-primary transition-colors"
                            >
                              <Volume2 size={14} />
                            </button>
                          </div>

                          {/* 第二行：控制按钮 + 中文释义 */}
                          <div className="flex items-center gap-3 mt-2">
                            {word.kanji && (
                              <button
                                onClick={() => toggleWordKanji(originalIndex)}
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
                            <button
                              onClick={() => toggleWordMeaning(originalIndex)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted
                                         hover:text-primary transition-colors"
                              title={word.showMeaning ? "隐藏释义" : "显示释义"}
                            >
                              {word.showMeaning ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
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
                          onChange={(level) => void handleMastery(originalIndex, level)}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
