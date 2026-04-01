"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  BrainCircuit,
  Clock,
  BookOpen,
  Target,
  TriangleAlert,
} from "lucide-react";
import { getHistoryStats, type HistoryStats } from "@/services/progress";
import { generateProgressInsight } from "@/services/progress-insights";
import { subscribeDataUpdated } from "@/services/events";

const EMPTY_STATS: HistoryStats = {
  lessonsStudied: 0,
  masteredItems: 0,
  totalStudyMinutes: 0,
  wrongAnswersCount: 0,
  totalQuizSessions: 0,
  moduleMasteryCounts: {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
  },
  moduleProgress: {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
  },
  quizAccuracyByType: {
    multiple_choice: 0,
    fill_blank: 0,
    translation: 0,
  },
  recentQuizSessions: [],
  weakItems: [],
};

const QUIZ_TYPE_LABELS = {
  multiple_choice: "选择题",
  fill_blank: "填空题",
  translation: "翻译题",
} as const;

const SOURCE_LABELS = {
  random_scope: "随机范围",
  manual_targets: "指定目标",
  weak_items: "薄弱项",
  mixed: "混合强化",
} as const;

export default function HistoryPage() {
  const [stats, setStats] = useState<HistoryStats>(EMPTY_STATS);
  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");

  const loadStats = useCallback(async () => {
    setStats(await getHistoryStats());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStats();
    });
    return subscribeDataUpdated(() => {
      void loadStats();
    });
  }, [loadStats]);

  const handleGenerateInsight = async () => {
    setInsightLoading(true);
    setInsightError("");

    try {
      const content = await generateProgressInsight(stats);
      setInsight(content);
    } catch (err) {
      setInsightError(
        err instanceof Error ? err.message : "AI 学情点评生成失败。"
      );
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">
          学习记录
          <span className="text-text-muted font-normal ml-2 text-sm">
            きろく
          </span>
        </h1>
        <p className="text-xs text-text-muted mt-1">查看学习进度与统计</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">
              {stats.lessonsStudied}
            </p>
            <p className="text-xs text-text-muted">已学课次</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-mastered/10">
            <BarChart3 size={20} className="text-mastered" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">
              {stats.masteredItems}
            </p>
            <p className="text-xs text-text-muted">已掌握知识点</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Clock size={20} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">
              {stats.totalStudyMinutes} 分
            </p>
            <p className="text-xs text-text-muted">总学习时长</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-weak/10">
            <TriangleAlert size={20} className="text-weak" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">
              {stats.wrongAnswersCount}
            </p>
            <p className="text-xs text-text-muted">累计错题</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">
              {stats.totalQuizSessions}
            </p>
            <p className="text-xs text-text-muted">已完成测验</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text mb-4">模块掌握概览</h2>
          <div className="space-y-3">
            {[
              ["单词", stats.moduleProgress.vocabulary, stats.moduleMasteryCounts.vocabulary],
              ["语法", stats.moduleProgress.grammar, stats.moduleMasteryCounts.grammar],
              ["课文", stats.moduleProgress.text, stats.moduleMasteryCounts.text],
              ["例句", stats.moduleProgress.examples, stats.moduleMasteryCounts.examples],
            ].map(([label, progress, masteredCount]) => (
              <div key={String(label)}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-text">{label}</span>
                  <span className="text-text-muted">
                    {progress}% · 已掌握 {masteredCount} 项
                  </span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text mb-4">题型正确率</h2>
          <div className="space-y-3">
            {[
              ["选择题", stats.quizAccuracyByType.multiple_choice],
              ["填空题", stats.quizAccuracyByType.fill_blank],
              ["翻译题", stats.quizAccuracyByType.translation],
            ].map(([label, accuracy]) => (
              <div key={String(label)}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-text">{label}</span>
                  <span className="text-text-muted">{accuracy}%</span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text mb-4">最近测验</h2>
          {stats.recentQuizSessions.length === 0 ? (
            <p className="text-sm text-text-secondary">暂时还没有测验记录</p>
          ) : (
            <div className="space-y-3">
              {stats.recentQuizSessions.map((session, index) => (
                <div
                  key={`${session.createdAt}-${index}`}
                  className="border border-border rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-text font-medium line-clamp-1">
                      {session.title}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {session.accuracy}%
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    第 {session.lessonId} 課 · {session.module} ·{" "}
                    {QUIZ_TYPE_LABELS[session.questionType]} ·{" "}
                    {SOURCE_LABELS[session.sourceType]}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1">
                    {new Date(session.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text mb-4">高频薄弱项</h2>
          {stats.weakItems.length === 0 ? (
            <p className="text-sm text-text-secondary">暂无薄弱知识点</p>
          ) : (
            <div className="space-y-3">
              {stats.weakItems.map((item) => (
                <div
                  key={`${item.module}-${item.lessonId}-${item.itemKey}`}
                  className="border border-border rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>第 {item.lessonId} 課</span>
                    <span>·</span>
                    <span>{item.module}</span>
                    <span>·</span>
                    <span>{item.status === "weak" ? "不会" : "模糊"}</span>
                  </div>
                  <p className="text-sm text-text mt-1">{item.itemKey}</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    复习 {item.reviewCount} 次
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-medium text-text">AI 学情点评</h2>
              <p className="text-xs text-text-muted mt-1">
                基于掌握度、错题和最近测验结果生成学习建议
              </p>
            </div>
            <button
              onClick={() => void handleGenerateInsight()}
              disabled={insightLoading}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border
                         text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              {insightLoading ? (
                <BarChart3 size={14} className="animate-pulse" />
              ) : (
                <BrainCircuit size={14} />
              )}
              生成点评
            </button>
          </div>

          {insightError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              {insightError}
            </div>
          )}

          {!insight && !insightLoading && !insightError && (
            <p className="text-sm text-text-secondary">
              点击“生成点评”，让 AI 根据你的最近学习和测验表现给出建议。
            </p>
          )}

          {insightLoading && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <BrainCircuit size={16} className="animate-pulse" />
              AI 正在分析你的学习轨迹…
            </div>
          )}

          {insight && (
            <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {insight}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
