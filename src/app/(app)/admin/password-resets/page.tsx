"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw, Inbox, Clock, Shield } from "lucide-react";

interface ResetRequest {
  id: number;
  userId: string;
  username: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  processedAt: number | null;
  processedBy: string | null;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PasswordResetsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [scope, setScope] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/password-resets?scope=${scope}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("加载失败");
        return;
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setError("网络异常");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/password-resets/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "操作失败");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text flex items-center gap-2">
            <Inbox size={18} />
            密码重置申请
          </h1>
          <p className="text-xs text-text-muted mt-1">
            用户密保答错锁定后留言申请；批准 = 解锁 + 标记重置，用户下次登录会被引导设置新凭证
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-primary hover:border-primary/40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setScope("pending")}
          className={`px-3 py-1.5 rounded-lg ${
            scope === "pending"
              ? "bg-primary/10 text-primary font-medium"
              : "border border-border text-text-secondary hover:text-text"
          }`}
        >
          待处理
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-1.5 rounded-lg ${
            scope === "all"
              ? "bg-primary/10 text-primary font-medium"
              : "border border-border text-text-secondary hover:text-text"
          }`}
        >
          全部历史
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-text-muted text-sm py-12 text-center">加载中...</div>
      ) : requests.length === 0 ? (
        <div className="text-text-muted text-sm py-12 text-center">
          {scope === "pending" ? "暂无待处理申请" : "暂无历史申请"}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="px-4 py-3 rounded-lg border border-border bg-bg-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-text">{r.username}</span>
                    <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
                      <Clock size={11} />
                      {formatTime(r.createdAt)}
                    </span>
                    {r.status === "approved" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        已批准
                      </span>
                    )}
                    {r.status === "rejected" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        已驳回
                      </span>
                    )}
                  </div>
                  {r.message && (
                    <div className="mt-1.5 text-xs text-text-secondary whitespace-pre-wrap break-words">
                      {r.message}
                    </div>
                  )}
                  {r.processedAt && (
                    <div className="mt-1 text-[11px] text-text-muted inline-flex items-center gap-1">
                      <Shield size={10} />
                      {formatTime(r.processedAt)}
                      {r.processedBy ? ` · by ${r.processedBy.slice(0, 8)}` : ""}
                    </div>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => void act(r.id, "approve")}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary text-white disabled:opacity-50 hover:bg-primary/90"
                    >
                      <Check size={12} />
                      批准
                    </button>
                    <button
                      onClick={() => void act(r.id, "reject")}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-border text-text-secondary disabled:opacity-50 hover:text-red-500 hover:border-red-300"
                    >
                      <X size={12} />
                      驳回
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
