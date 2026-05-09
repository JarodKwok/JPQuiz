"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, Check, Clock, ScanLine, AlertCircle } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";

type PlanKey = "monthly" | "yearly";
type Channel = "alipay" | "wechat";

const PLANS: {
  key: PlanKey;
  label: string;
  priceYuan: number;
  durationLabel: string;
  highlight?: boolean;
  perDay?: string;
}[] = [
  {
    key: "monthly",
    label: "月度会员",
    priceYuan: 3,
    durationLabel: "30 天",
    perDay: "约 0.10 元 / 天",
  },
  {
    key: "yearly",
    label: "年度会员",
    priceYuan: 30,
    durationLabel: "365 天",
    highlight: true,
    perDay: "约 0.08 元 / 天",
  },
];

const CHANNELS: {
  key: Channel;
  label: string;
  tip: string;
  enabled: boolean;
  /** 每个 plan 一张固定金额收款码 */
  qrByPlan?: Record<PlanKey, string>;
}[] = [
  {
    key: "alipay",
    label: "支付宝",
    tip: "打开支付宝 → 扫一扫",
    enabled: true,
    qrByPlan: {
      monthly: "/qr/alipay-monthly.png",
      yearly: "/qr/alipay-yearly.png",
    },
  },
  {
    key: "wechat",
    label: "微信（稍后开通）",
    tip: "微信支付暂未开放，请先用支付宝",
    enabled: false,
  },
];

interface MyOrder {
  id: string;
  plan: PlanKey;
  amountCents: number;
  status: "pending" | "paid" | "activated" | "cancelled";
  paymentChannel: string;
  userNote: string | null;
  createdAt: number;
  activatedAt: number | null;
}

const STATUS_TEXT: Record<MyOrder["status"], { text: string; tone: string }> = {
  pending: { text: "待管理员核单", tone: "text-amber-600" },
  paid: { text: "已报付", tone: "text-amber-600" },
  activated: { text: "已激活", tone: "text-emerald-600" },
  cancelled: { text: "已作废", tone: "text-red-500" },
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowLabel(): string {
  return new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SubscribePage() {
  const { activeProfile } = useAccountStore();
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const [channel, setChannel] = useState<Channel>("alipay");
  const [txnTail, setTxnTail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);

  const usernameLabel = activeProfile?.username || activeProfile?.displayName || "未设置";

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/orders/my", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const isPremium =
    activeProfile?.tier === "premium" &&
    (activeProfile?.tierExpiresAt ?? 0) > Date.now();

  const submit = async () => {
    setError(null);
    if (!/^\d{6}$/.test(txnTail)) {
      setError("请填写支付宝交易订单号后 6 位数字（用于精确核对账单）");
      return;
    }
    // 提交瞬间合成完整备注
    const composed = `用户名 ${usernameLabel}；付款时间 ${nowLabel()}；订单号尾号 ${txnTail}`;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/report-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, paymentChannel: channel, userNote: composed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "提交失败");
        return;
      }
      setTxnTail("");
      await loadOrders();
    } catch {
      setError("网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = PLANS.find((p) => p.key === plan)!;
  const selectedChannel = CHANNELS.find((c) => c.key === channel)!;
  const qrSrc = selectedChannel.qrByPlan?.[plan];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-text flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          开通 AI 会员
        </h1>
        <p className="text-xs text-text-muted mt-1">
          扫码付款 → 填写备注「我已付款」→ 管理员核对后激活（通常 1 个工作日内）
        </p>
      </div>

      {isPremium && activeProfile?.tierExpiresAt && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check size={16} />
          你当前已是会员，到期：{formatTime(activeProfile.tierExpiresAt)}（继续付款会续期）
        </div>
      )}

      {/* Plan picker */}
      <section className="space-y-2">
        <div className="text-xs text-text-muted">1. 选择套餐</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((p) => {
            const active = plan === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPlan(p.key)}
                className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{p.label}</span>
                  {p.highlight && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      推荐
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-lg font-semibold text-text">¥{p.priceYuan}</span>
                  <span className="text-[11px] text-text-muted">/ {p.durationLabel}</span>
                </div>
                {p.perDay && (
                  <div className="text-[11px] text-text-muted mt-0.5">{p.perDay}</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Channel picker */}
      <section className="space-y-2">
        <div className="text-xs text-text-muted">2. 选择支付通道</div>
        <div className="flex gap-2">
          {CHANNELS.map((c) => {
            const active = channel === c.key;
            const disabled = !c.enabled;
            return (
              <button
                key={c.key}
                onClick={() => !disabled && setChannel(c.key)}
                disabled={disabled}
                title={disabled ? c.tip : undefined}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  disabled
                    ? "border-border text-text-muted opacity-60 cursor-not-allowed"
                    : active
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-text-secondary hover:border-primary/40"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* QR + instructions */}
      <section className="px-4 py-4 rounded-lg border border-border bg-bg-card flex flex-col sm:flex-row gap-4">
        <div className="shrink-0 w-56 h-56 mx-auto sm:mx-0 rounded-lg overflow-hidden bg-white border border-border flex items-center justify-center">
          {qrSrc ? (
            <Image
              src={qrSrc}
              alt={`${selectedChannel.label} ${selectedPlan.label} 收款码`}
              width={224}
              height={224}
              className="object-contain"
              unoptimized
            />
          ) : (
            <span className="text-xs text-text-muted px-3 text-center">
              该通道暂未开放，请改用支付宝。
            </span>
          )}
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-text">
            <ScanLine size={14} className="text-primary" />
            {selectedChannel.tip}
          </div>
          <div className="text-text-secondary">
            金额：<span className="font-semibold text-text">¥{selectedPlan.priceYuan}</span>
            （{selectedPlan.label}，扫码自动填好金额）
          </div>
          <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5 leading-relaxed">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              个人收款码无法自动到账。付款后请在下方填写备注（付款时间 / 你的用户名），管理员对单后会激活会员（通常 1 个工作日内）。
            </span>
          </div>
        </div>
      </section>

      {/* Report paid */}
      <section className="space-y-2">
        <div className="text-xs text-text-muted">3. 付款完成后提交订单</div>

        {/* 自动备注预览（只读） */}
        <div className="px-3 py-2 rounded-lg border border-border bg-bg-card text-xs text-text-secondary">
          <div className="text-[11px] text-text-muted mb-1">系统自动附带的信息：</div>
          <div className="text-text">
            用户名 <span className="font-medium">{usernameLabel}</span> · 付款时间将在提交瞬间记录
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">
            支付宝交易订单号后 6 位 <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={txnTail}
            onChange={(e) => setTxnTail(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="例如 482917"
            className="w-40 px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text tracking-widest
                       placeholder:text-text-muted placeholder:tracking-normal
                       focus:outline-none focus:border-primary font-mono"
          />
          <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
            支付宝 → 我的 → 账单 → 找到这笔交易 → 点详情 → 「商家订单号」或「支付宝交易号」最后 6 位数字。
            填了这 6 位，管理员核单更准确，避免按时间近似匹配出错。
          </p>
        </label>

        {error && <div className="text-xs text-red-500">{error}</div>}
        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="px-5 py-2 text-sm rounded-lg bg-primary text-white font-medium
                     disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {submitting ? "提交中..." : "我已付款，提交订单"}
        </button>
      </section>

      {/* My orders */}
      <section className="space-y-2 pt-2 border-t border-border">
        <h2 className="text-sm font-medium text-text flex items-center gap-1.5">
          <Clock size={14} />
          我的订单
        </h2>
        {orders.length === 0 ? (
          <div className="text-xs text-text-muted py-3">暂无订单</div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {orders.map((o) => {
              const status = STATUS_TEXT[o.status];
              return (
                <div key={o.id} className="px-3 py-2.5 text-xs flex items-start gap-3">
                  <div className="font-mono text-text-muted shrink-0">{o.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text">
                      {o.plan === "monthly" ? "月度" : "年度"} · ¥{(o.amountCents / 100).toFixed(2)} · {o.paymentChannel}
                    </div>
                    {o.userNote && (
                      <div className="text-text-muted mt-0.5 break-words">备注：{o.userNote}</div>
                    )}
                    <div className="text-text-muted mt-0.5">
                      {formatTime(o.createdAt)}
                      {o.activatedAt ? ` · 激活 ${formatTime(o.activatedAt)}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 ${status.tone}`}>{status.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
