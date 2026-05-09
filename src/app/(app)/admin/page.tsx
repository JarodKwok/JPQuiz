"use client";

import { useEffect, useState } from "react";
import {
  Users, Clock, Target, BookOpen, Sparkles, Crown, AlertCircle,
} from "lucide-react";
import {
  getAdminDashboardStats,
  type AdminDashboardStats,
  type PerUserStats,
} from "@/services/adminStats";

const EMPTY: AdminDashboardStats = {
  totalUsers: 0,
  totalStudyMinutes: 0,
  totalQuizSessions: 0,
  totalMasteredItems: 0,
  yearMonth: "",
  totalAICallsThisMonth: 0,
  activePremiumUsers: 0,
  expiringSoon: [],
  aiUsageRanking: [],
  perUserStats: [],
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setStats(await getAdminDashboardStats());
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "学习用户", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "总学习时长", value: `${stats.totalStudyMinutes} 分`, icon: Clock, color: "text-matcha" },
    { label: "测验次数", value: stats.totalQuizSessions, icon: Target, color: "text-amber-500" },
    { label: "已掌握词条", value: stats.totalMasteredItems, icon: BookOpen, color: "text-sky-500" },
    {
      label: `本月 AI 调用 (${stats.yearMonth || "-"})`,
      value: stats.totalAICallsThisMonth,
      icon: Sparkles,
      color: "text-emerald-600",
    },
    { label: "当前付费用户", value: stats.activePremiumUsers, icon: Crown, color: "text-amber-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold text-text mb-1">仪表盘</h1>
      <p className="text-sm text-text-muted mb-6">系统整体学习数据 + AI 用量概览</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={16} className={c.color} />
              <span className="text-xs text-text-muted">{c.label}</span>
            </div>
            <div className="text-xl font-semibold text-text">
              {loading ? "..." : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* AI 维度：即将过期 + 用量排行 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
        {/* 即将过期会员 */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500" />
            <h2 className="text-sm font-medium text-text">7 天内到期会员</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-text-muted">加载中...</div>
          ) : stats.expiringSoon.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-muted">无即将到期会员</div>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {stats.expiringSoon.map((u) => {
                const daysLeft = Math.ceil((u.tierExpiresAt - Date.now()) / 86_400_000);
                return (
                  <li key={u.userId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-text truncate">{u.displayName}</div>
                      <div className="text-[11px] text-text-muted">
                        {u.phone ?? "无手机号"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-text-muted">
                        {new Date(u.tierExpiresAt).toLocaleDateString("zh-CN")}
                      </div>
                      <div className={`text-[11px] font-medium ${daysLeft <= 3 ? "text-weak" : "text-amber-600"}`}>
                        还剩 {daysLeft} 天
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 本月 AI 用量排行 */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-600" />
            <h2 className="text-sm font-medium text-text">本月 AI 用量排行（前 10）</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-text-muted">加载中...</div>
          ) : stats.aiUsageRanking.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-muted">本月暂无 AI 调用</div>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {stats.aiUsageRanking.map((u, i) => (
                <li key={u.userId} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-text-muted w-4 text-right">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-text truncate flex items-center gap-1.5">
                      {u.displayName}
                      {u.isPremium && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700">
                          <Crown size={9} />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {u.phone ?? "无手机号"}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-text font-medium">{u.currentMonthUsage}</span>
                    <span className="text-text-muted"> / {u.monthlyQuota || "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Per-user table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-text">用户学习详情</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-text-muted">加载中...</div>
        ) : stats.perUserStats.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            暂无用户数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="text-left px-4 py-2.5 font-medium">用户</th>
                  <th className="text-right px-4 py-2.5 font-medium">课数</th>
                  <th className="text-right px-4 py-2.5 font-medium">掌握</th>
                  <th className="text-right px-4 py-2.5 font-medium">时长</th>
                  <th className="text-right px-4 py-2.5 font-medium">测验</th>
                  <th className="text-right px-4 py-2.5 font-medium">本月 AI</th>
                  <th className="text-right px-4 py-2.5 font-medium">最后活跃</th>
                </tr>
              </thead>
              <tbody>
                {stats.perUserStats.map((user: PerUserStats) => (
                  <tr
                    key={user.userId}
                    className="border-b border-border last:border-0 hover:bg-border/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{user.avatarEmoji}</span>
                        <div>
                          <div className="font-medium text-text flex items-center gap-1">
                            {user.displayName}
                            {user.role === "admin" && (
                              <span className="text-[10px] text-primary font-medium">管理员</span>
                            )}
                            {user.isPremium && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700">
                                <Crown size={9} />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted">
                            {user.phone ?? "无手机号"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 text-text-secondary">
                      {user.lessonsStudied}
                    </td>
                    <td className="text-right px-4 py-3 text-text-secondary">
                      {user.masteredItems}
                    </td>
                    <td className="text-right px-4 py-3 text-text-secondary">
                      {user.totalStudyMinutes} 分
                    </td>
                    <td className="text-right px-4 py-3 text-text-secondary">
                      {user.totalQuizSessions}
                    </td>
                    <td className="text-right px-4 py-3 text-text-secondary">
                      {user.currentMonthUsage}/{user.monthlyQuota || "—"}
                    </td>
                    <td className="text-right px-4 py-3 text-text-muted text-xs">
                      {new Date(user.lastActiveAt).toLocaleDateString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
