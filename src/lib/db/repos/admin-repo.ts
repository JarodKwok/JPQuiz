import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";
import { currentYearMonth } from "./admin-config-repo";
import { FREE_MONTHLY_QUOTA, PREMIUM_MONTHLY_QUOTA } from "../config";

const SEVEN_DAYS_MS = 7 * 86_400_000;

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  role: string;
  phone: string | null;
  tier: string;
  tier_expires_at: number | null;
  last_active_at: string;
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "admin/dashboard": () => {
    const db = getDb();
    const now = Date.now();
    const yearMonth = currentYearMonth();

    // All profiles (excluding local-default)
    const profiles = db.prepare(
      "SELECT * FROM user_profiles WHERE id != 'local-default' ORDER BY last_active_at DESC"
    ).all() as ProfileRow[];

    // Per-user aggregate stats via SQL
    const studyMinutes = db.prepare(
      "SELECT owner_id, SUM(duration_seconds) / 60.0 as minutes FROM study_sessions GROUP BY owner_id"
    ).all() as Array<{ owner_id: string; minutes: number }>;
    const studyMap = new Map(studyMinutes.map(r => [r.owner_id, r.minutes]));

    const quizCounts = db.prepare(
      "SELECT owner_id, COUNT(*) as cnt FROM quiz_sessions GROUP BY owner_id"
    ).all() as Array<{ owner_id: string; cnt: number }>;
    const quizMap = new Map(quizCounts.map(r => [r.owner_id, r.cnt]));

    const masteredCounts = db.prepare(
      "SELECT owner_id, COUNT(*) as cnt FROM mastery_status WHERE status = 'mastered' GROUP BY owner_id"
    ).all() as Array<{ owner_id: string; cnt: number }>;
    const masteredMap = new Map(masteredCounts.map(r => [r.owner_id, r.cnt]));

    const lessonsStudied = db.prepare(
      "SELECT owner_id, COUNT(DISTINCT lesson_id) as cnt FROM learning_progress GROUP BY owner_id"
    ).all() as Array<{ owner_id: string; cnt: number }>;
    const lessonsMap = new Map(lessonsStudied.map(r => [r.owner_id, r.cnt]));

    // ── AI 维度 ──────────────────────────────────────────────────────────
    const aiUsageRows = db.prepare(
      "SELECT user_id, count FROM ai_usage_monthly WHERE year_month = ?"
    ).all(yearMonth) as Array<{ user_id: string; count: number }>;
    const aiUsageMap = new Map(aiUsageRows.map(r => [r.user_id, r.count]));

    const totalAICallsThisMonth = aiUsageRows.reduce((sum, r) => sum + r.count, 0);

    const activePremiumUsers = profiles.filter(
      p => p.tier === "premium" && (p.tier_expires_at ?? 0) > now
    ).length;

    const expiringSoon = profiles
      .filter(p =>
        p.tier === "premium" &&
        (p.tier_expires_at ?? 0) > now &&
        (p.tier_expires_at ?? 0) <= now + SEVEN_DAYS_MS
      )
      .map(p => ({
        userId: p.id,
        displayName: p.display_name,
        phone: p.phone,
        tierExpiresAt: p.tier_expires_at!,
      }))
      .sort((a, b) => a.tierExpiresAt - b.tierExpiresAt);

    // 本月 AI 调用排行（前 10）
    const aiUsageRanking = profiles
      .map(p => {
        const isPremium = p.tier === "premium" && (p.tier_expires_at ?? 0) > now;
        return {
          userId: p.id,
          displayName: p.display_name,
          phone: p.phone,
          tier: (p.tier as "free" | "premium") ?? "free",
          isPremium,
          monthlyQuota: isPremium ? PREMIUM_MONTHLY_QUOTA : FREE_MONTHLY_QUOTA,
          currentMonthUsage: aiUsageMap.get(p.id) ?? 0,
        };
      })
      .filter(r => r.currentMonthUsage > 0)
      .sort((a, b) => b.currentMonthUsage - a.currentMonthUsage)
      .slice(0, 10);

    // ── 每用户聚合 ───────────────────────────────────────────────────────
    const perUserStats = profiles.map(p => {
      const isPremium = p.tier === "premium" && (p.tier_expires_at ?? 0) > now;
      return {
        userId: p.id,
        displayName: p.display_name,
        avatarEmoji: p.avatar_emoji,
        role: p.role,
        phone: p.phone,
        tier: (p.tier as "free" | "premium") ?? "free",
        isPremium,
        tierExpiresAt: p.tier_expires_at,
        currentMonthUsage: aiUsageMap.get(p.id) ?? 0,
        monthlyQuota: isPremium ? PREMIUM_MONTHLY_QUOTA : FREE_MONTHLY_QUOTA,
        lessonsStudied: lessonsMap.get(p.id) ?? 0,
        masteredItems: masteredMap.get(p.id) ?? 0,
        totalStudyMinutes: Math.round(studyMap.get(p.id) ?? 0),
        totalQuizSessions: quizMap.get(p.id) ?? 0,
        lastActiveAt: p.last_active_at,
      };
    });

    let totalStudyMinutes = 0;
    let totalQuizSessions = 0;
    let totalMasteredItems = 0;
    for (const s of perUserStats) {
      totalStudyMinutes += s.totalStudyMinutes;
      totalQuizSessions += s.totalQuizSessions;
      totalMasteredItems += s.masteredItems;
    }

    return {
      totalUsers: profiles.filter(p => p.role === "user").length,
      totalStudyMinutes,
      totalQuizSessions,
      totalMasteredItems,
      // 新增
      yearMonth,
      totalAICallsThisMonth,
      activePremiumUsers,
      expiringSoon,
      aiUsageRanking,
      perUserStats,
    };
  },
};
