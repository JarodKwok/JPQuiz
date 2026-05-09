"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import {
  getSystemLogs,
  clearOldLogs,
} from "@/services/systemLog";
import type { SystemLog, LogCategory, LogLevel } from "@/types/log";

const CATEGORY_LABELS: Record<LogCategory, string> = {
  account: "账户",
  quiz: "测验",
  settings: "设置",
  system: "系统",
};

const CATEGORY_COLORS: Record<LogCategory, string> = {
  account: "bg-primary/10 text-primary",
  quiz: "bg-amber-500/10 text-amber-600",
  settings: "bg-sky-500/10 text-sky-600",
  system: "bg-text-muted/10 text-text-muted",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-text-secondary",
  warn: "text-amber-600",
  error: "text-weak",
};

const PAGE_SIZE = 30;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterCategory, setFilterCategory] = useState<LogCategory | "">("");
  const [filterLevel, setFilterLevel] = useState<LogLevel | "">("");
  const [confirmClear, setConfirmClear] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const result = await getSystemLogs({
      category: filterCategory || undefined,
      level: filterLevel || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setLogs(result.logs);
    setTotal(result.total);
    setLoading(false);
  }, [filterCategory, filterLevel, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleClear = async () => {
    await clearOldLogs(7);
    setConfirmClear(false);
    setPage(0);
    void loadLogs();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-text">系统日志</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadLogs()}
            className="p-1.5 rounded-lg hover:bg-border/40 text-text-muted hover:text-text transition-colors"
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
          {confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void handleClear()}
                className="px-2.5 py-1 text-xs rounded-lg bg-weak text-white"
              >
                确认清理 7 天前
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border text-text-secondary"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border text-text-secondary hover:text-weak hover:border-weak/40 transition-colors"
            >
              <Trash2 size={12} />
              清理旧日志
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-text-muted mb-4">
        查看系统操作记录，共 {total} 条
      </p>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value as LogCategory | ""); setPage(0); }}
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
        >
          <option value="">全部类别</option>
          {(Object.keys(CATEGORY_LABELS) as LogCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => { setFilterLevel(e.target.value as LogLevel | ""); setPage(0); }}
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
        >
          <option value="">全部级别</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Log list */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-muted">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            暂无日志记录
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      CATEGORY_COLORS[log.category]
                    }`}
                  >
                    {CATEGORY_LABELS[log.category]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${LEVEL_COLORS[log.level]}`}>
                    {log.message}
                  </p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">
                      {JSON.stringify(log.metadata)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-[11px] text-text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-xs rounded-lg border border-border text-text-secondary disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-xs text-text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-xs rounded-lg border border-border text-text-secondary disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
