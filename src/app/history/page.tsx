"use client";

import { BarChart3, Clock, BookOpen } from "lucide-react";

export default function HistoryPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">
          学习记录
          <span className="text-text-muted font-normal ml-2 text-sm">
            きろく
          </span>
        </h1>
        <p className="text-xs text-text-muted mt-1">
          查看学习进度与统计
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">0</p>
            <p className="text-xs text-text-muted">已学课次</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-mastered/10">
            <BarChart3 size={20} className="text-mastered" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">0</p>
            <p className="text-xs text-text-muted">已掌握知识点</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Clock size={20} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text">0 分</p>
            <p className="text-xs text-text-muted">总学习时长</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-text-secondary">暂无学习记录</p>
        <p className="text-xs text-text-muted mt-1">
          开始学习后，进度和统计数据将自动记录在这里
        </p>
      </div>
    </div>
  );
}
