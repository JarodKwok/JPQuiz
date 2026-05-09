"use client";

export interface PerUserStats {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  role: "admin" | "user";
  phone: string | null;
  tier: "free" | "premium";
  isPremium: boolean;
  tierExpiresAt: number | null;
  currentMonthUsage: number;
  monthlyQuota: number;
  lessonsStudied: number;
  masteredItems: number;
  totalStudyMinutes: number;
  totalQuizSessions: number;
  lastActiveAt: string;
}

export interface ExpiringSoonItem {
  userId: string;
  displayName: string;
  phone: string | null;
  tierExpiresAt: number;
}

export interface AIUsageRankItem {
  userId: string;
  displayName: string;
  phone: string | null;
  tier: "free" | "premium";
  isPremium: boolean;
  monthlyQuota: number;
  currentMonthUsage: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalStudyMinutes: number;
  totalQuizSessions: number;
  totalMasteredItems: number;
  yearMonth: string;
  totalAICallsThisMonth: number;
  activePremiumUsers: number;
  expiringSoon: ExpiringSoonItem[];
  aiUsageRanking: AIUsageRankItem[];
  perUserStats: PerUserStats[];
}

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

/** 获取管理员仪表盘统计（跨用户聚合 + AI 维度） */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const res = await fetch("/api/db/admin/dashboard");
  if (!res.ok) return EMPTY;
  return res.json();
}
