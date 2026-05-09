"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw, Inbox, Clock } from "lucide-react";

interface Order {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  plan: "monthly" | "yearly";
  amountCents: number;
  status: "pending" | "paid" | "activated" | "cancelled";
  userNote: string | null;
  paymentChannel: "alipay" | "wechat" | "other";
  createdAt: number;
  paidAt: number | null;
  activatedAt: number | null;
  activatedBy: string | null;
}

const STATUS_TEXT: Record<Order["status"], { text: string; cls: string }> = {
  pending: { text: "待核单", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  paid: { text: "已报付", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  activated: { text: "已激活", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled: { text: "已作废", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const CHANNEL_LABEL: Record<Order["paymentChannel"], string> = {
  alipay: "支付宝",
  wechat: "微信",
  other: "其他",
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [scope, setScope] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders?scope=${scope}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("加载失败");
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setError("网络异常");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "activate" | "cancel") => {
    if (action === "activate") {
      const ok = window.confirm(
        "确认款项已到账？激活后该用户立即变为 premium，到期时间会按套餐天数计算（如已是会员则在原到期时间上叠加）。"
      );
      if (!ok) return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}/${action}`, {
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
            订单管理
          </h1>
          <p className="text-xs text-text-muted mt-1">
            个人收款码无回调，需对照支付宝 / 微信流水手动激活；激活后用户立即升级 premium
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
      ) : orders.length === 0 ? (
        <div className="text-text-muted text-sm py-12 text-center">
          {scope === "pending" ? "暂无待处理订单" : "暂无订单"}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const status = STATUS_TEXT[o.status];
            const canAct = o.status === "pending" || o.status === "paid";
            return (
              <div key={o.id} className="px-4 py-3 rounded-lg border border-border bg-bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-mono text-xs text-text-muted">{o.id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.cls}`}>
                        {status.text}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm text-text">
                      <span className="font-medium">{o.username || o.displayName}</span>
                      <span className="text-text-muted"> · {o.plan === "monthly" ? "月度" : "年度"} · </span>
                      <span className="font-semibold">¥{(o.amountCents / 100).toFixed(2)}</span>
                      <span className="text-text-muted"> · {CHANNEL_LABEL[o.paymentChannel]}</span>
                    </div>
                    {o.userNote && (
                      <div className="mt-1.5 px-2.5 py-1.5 rounded bg-bg text-xs text-text-secondary whitespace-pre-wrap break-words border border-border">
                        {o.userNote}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-text-muted inline-flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(o.createdAt)}
                      {o.activatedAt ? ` · 激活 ${formatTime(o.activatedAt)}` : ""}
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => void act(o.id, "activate")}
                        disabled={busyId === o.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary text-white disabled:opacity-50 hover:bg-primary/90"
                      >
                        <Check size={12} />
                        激活
                      </button>
                      <button
                        onClick={() => void act(o.id, "cancel")}
                        disabled={busyId === o.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-border text-text-secondary disabled:opacity-50 hover:text-red-500 hover:border-red-300"
                      >
                        <X size={12} />
                        作废
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
