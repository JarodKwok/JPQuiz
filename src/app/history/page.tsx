"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Clock, BookOpen, TriangleAlert } from "lucide-react";
import { getHistoryStats, type HistoryStats } from "@/services/progress";
import { subscribeDataUpdated } from "@/services/events";

const EMPTY_STATS: HistoryStats = {
  lessonsStudied: 0,
  masteredItems: 0,
  totalStudyMinutes: 0,
  wrongAnswersCount: 0,
  moduleMasteryCounts: {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
    listening: 0,
  },
  moduleProgress: {
    vocabulary: 0,
    grammar: 0,
    text: 0,
    examples: 0,
    listening: 0,
  },
  weakItems: [],
};

export default function HistoryPage() {
  const [stats, setStats] = useState<HistoryStats>(EMPTY_STATS);

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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
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
              ["听力", stats.moduleProgress.listening, stats.moduleMasteryCounts.listening],
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
      </div>
    </div>
  );
}
