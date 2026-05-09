"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Trash2, Pencil, ShieldCheck, ArrowRightLeft, Sparkles, Ban, ShieldOff,
} from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import type { UserProfile } from "@/types/account";

const EMOJI_OPTIONS = [
  "🌸", "🌻", "🌊", "🔥", "🌙", "🍀", "🦊", "🐱",
  "🐻", "🎵", "📚", "🎯", "🏆", "💎", "🌈", "🍣",
];

interface AdminUserExtras {
  phone: string | null;
  tier: "free" | "premium";
  tierExpiresAt: number | null;
  isPremium: boolean;
  monthlyQuota: number;
  currentMonthUsage: number;
}

export default function AdminUsersPage() {
  const {
    activeUserId,
    accounts,
    deleteAccount,
    updateAccount,
    transferData,
  } = useAccountStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Transfer data state
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferToId, setTransferToId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<string | null>(null);

  // 后台增强数据：tier / 本月用量
  const [extras, setExtras] = useState<Map<string, AdminUserExtras>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshExtras = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) return;
      const { users } = await res.json();
      const map = new Map<string, AdminUserExtras>();
      for (const u of users) {
        map.set(u.id, {
          phone: u.phone,
          tier: u.tier,
          tierExpiresAt: u.tierExpiresAt,
          isPremium: u.isPremium,
          monthlyQuota: u.monthlyQuota,
          currentMonthUsage: u.currentMonthUsage,
        });
      }
      setExtras(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshExtras();
  }, [refreshExtras]);

  const handleGrant = async (userId: string, plan: "monthly" | "yearly") => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) await refreshExtras();
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/revoke`, { method: "POST" });
      if (res.ok) await refreshExtras();
    } finally {
      setBusyId(null);
    }
  };

  const handleSetRole = async (userId: string, role: "admin" | "user") => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        await refreshExtras();
        // role 改了，accountStore.accounts 也要刷一下让 sidebar/列表里的「管理员」badge 同步
        await useAccountStore.getState().refreshAccounts();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    await deleteAccount(userId);
    setConfirmDeleteId(null);
  };

  const handleStartEdit = (account: UserProfile) => {
    setEditingId(account.id);
    setEditName(account.displayName);
    setEditEmoji(account.avatarEmoji);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateAccount(editingId, {
      displayName: editName.trim(),
      avatarEmoji: editEmoji,
    });
    setEditingId(null);
  };

  const handleTransfer = async () => {
    if (!transferFromId || !transferToId) return;
    setTransferring(true);
    setTransferResult(null);
    try {
      const count = await transferData(transferFromId, transferToId);
      const fromName = accounts.find((a) => a.id === transferFromId)?.displayName;
      const toName = accounts.find((a) => a.id === transferToId)?.displayName;
      setTransferResult(`已将「${fromName}」的 ${count} 条数据迁移至「${toName}」`);
      setTransferFromId(null);
      setTransferToId("");
    } catch (err) {
      setTransferResult(`迁移失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-text mb-1">用户管理</h1>
      <p className="text-sm text-text-muted mb-6">
        管理本设备上的学习账户，每个账户的学习数据独立隔离。
      </p>

      {/* Account list */}
      <div className="space-y-3 mb-8">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`bg-bg-card border rounded-xl p-4 transition-colors ${
              account.id === activeUserId
                ? "border-primary ring-1 ring-primary/20"
                : "border-border"
            }`}
          >
            {editingId === account.id ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEditEmoji(e)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
                        editEmoji === e
                          ? "bg-primary/20 ring-1 ring-primary"
                          : "hover:bg-border/40"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:border-primary"
                    onKeyDown={(e) => e.key === "Enter" && void handleSaveEdit()}
                  />
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={!editName.trim()}
                    className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl">{account.avatarEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate flex items-center gap-1.5">
                    {account.displayName}
                    {account.role === "admin" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                        <ShieldCheck size={10} />
                        管理员
                      </span>
                    )}
                    {(() => {
                      const ex = extras.get(account.id);
                      if (!ex) return null;
                      return ex.isPremium ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700">
                          <Sparkles size={10} />
                          AI 已开通
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-text-muted/10 text-text-muted">
                          AI 未开通
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      {extras.get(account.id)?.phone ?? "无手机号"}
                    </span>
                    {(() => {
                      const ex = extras.get(account.id);
                      if (!ex) return null;
                      return (
                        <>
                          <span>
                            本月 AI: {ex.currentMonthUsage}/{ex.monthlyQuota || "—"}
                          </span>
                          {ex.tierExpiresAt && (
                            <span>
                              到期: {new Date(ex.tierExpiresAt).toLocaleDateString("zh-CN")}
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <span>
                      {account.id === activeUserId
                        ? "当前账户"
                        : `活跃: ${new Date(account.lastActiveAt).toLocaleDateString("zh-CN")}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const ex = extras.get(account.id);
                    const isPremium = !!ex?.isPremium;
                    const busy = busyId === account.id;
                    const isSelf = account.id === activeUserId;
                    return (
                      <>
                        <button
                          onClick={() => void handleGrant(account.id, "monthly")}
                          disabled={busy}
                          className="px-2 py-1 rounded-md text-[11px] border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50"
                          title={isPremium ? "续期 30 天" : "开通月度 AI（30 天）"}
                        >
                          +月
                        </button>
                        <button
                          onClick={() => void handleGrant(account.id, "yearly")}
                          disabled={busy}
                          className="px-2 py-1 rounded-md text-[11px] border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50"
                          title={isPremium ? "续期 365 天" : "开通年度 AI（365 天）"}
                        >
                          +年
                        </button>
                        {isPremium && (
                          <button
                            onClick={() => void handleRevoke(account.id)}
                            disabled={busy}
                            className="p-1.5 rounded-md text-text-muted hover:text-weak hover:bg-weak/10 disabled:opacity-50"
                            title="禁用 AI"
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        {!isSelf && account.role !== "admin" && (
                          <button
                            onClick={() => void handleSetRole(account.id, "admin")}
                            disabled={busy}
                            className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                            title="任命为管理员"
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}
                        {!isSelf && account.role === "admin" && (
                          <button
                            onClick={() => void handleSetRole(account.id, "user")}
                            disabled={busy}
                            className="p-1.5 rounded-md text-text-muted hover:text-weak hover:bg-weak/10 disabled:opacity-50"
                            title="取消管理员权限"
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <button
                    onClick={() => {
                      setTransferFromId(account.id);
                      setTransferToId("");
                      setTransferResult(null);
                    }}
                    className="p-1.5 rounded-lg hover:bg-border/40 text-text-muted hover:text-text transition-colors"
                    title="转移数据"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                  <button
                    onClick={() => handleStartEdit(account)}
                    className="p-1.5 rounded-lg hover:bg-border/40 text-text-muted hover:text-text transition-colors"
                    title="编辑"
                  >
                    <Pencil size={14} />
                  </button>
                  {account.role !== "admin" && (
                    <button
                      onClick={() => setConfirmDeleteId(account.id)}
                      className="p-1.5 rounded-lg hover:bg-weak/10 text-text-muted hover:text-weak transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Transfer data panel */}
            {transferFromId === account.id && (
              <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-text mb-2">
                  将「{account.displayName}」的全部学习数据转移给：
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="">选择目标用户...</option>
                    {accounts
                      .filter((a) => a.id !== account.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.avatarEmoji} {a.displayName}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => void handleTransfer()}
                    disabled={!transferToId || transferring}
                    className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
                  >
                    {transferring ? "迁移中..." : "确认迁移"}
                  </button>
                  <button
                    onClick={() => setTransferFromId(null)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {confirmDeleteId === account.id && (
              <div className="mt-3 p-3 bg-weak/5 border border-weak/20 rounded-lg">
                <p className="text-sm text-weak mb-2">
                  确定删除「{account.displayName}」？该账户的所有学习数据将被永久删除。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleDelete(account.id)}
                    className="px-3 py-1 text-xs rounded-lg bg-weak text-white"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-3 py-1 text-xs rounded-lg border border-border text-text-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Transfer result notification */}
      {transferResult && (
        <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-text">
          {transferResult}
          <button
            onClick={() => setTransferResult(null)}
            className="ml-2 text-xs text-text-muted hover:text-text"
          >
            关闭
          </button>
        </div>
      )}

      {/* 提示：用户由手机号注册自动产生，admin 不主动创建 */}
      <div className="text-xs text-text-muted text-center py-3">
        新用户通过 /login 用手机号自助注册即出现在此列表。
      </div>
    </div>
  );
}
