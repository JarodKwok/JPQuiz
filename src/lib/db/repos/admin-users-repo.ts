import { getDb } from "../sqlite";
import { currentYearMonth } from "./admin-config-repo";

export interface AdminUserRow {
  id: string;
  displayName: string;
  avatarEmoji: string;
  role: "admin" | "user";
  username: string | null;
  phone: string | null;
  tier: "free" | "premium";
  tierExpiresAt: number | null;
  createdAt: string;
  lastActiveAt: string;
  registeredAt: number | null;
  currentMonthUsage: number;
  accountLocked: boolean;
  passwordResetPending: boolean;
}

interface JoinedRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  role: string;
  username: string | null;
  phone: string | null;
  tier: string;
  tier_expires_at: number | null;
  created_at: string;
  last_active_at: string;
  registered_at: number | null;
  current_month_usage: number | null;
  account_locked_at: number | null;
  password_reset_pending: number;
}

/** 给 /admin/users 用的增强列表：含 tier、本月 AI 用量、锁定 / 重置标记 */
export function listAdminUsers(): AdminUserRow[] {
  const yearMonth = currentYearMonth();
  const rows = getDb()
    .prepare(
      `SELECT
         u.id, u.display_name, u.avatar_emoji, u.role,
         u.username, u.phone, u.tier, u.tier_expires_at,
         u.created_at, u.last_active_at, u.registered_at,
         u.account_locked_at, u.password_reset_pending,
         (SELECT count FROM ai_usage_monthly
          WHERE user_id = u.id AND year_month = ?) AS current_month_usage
       FROM user_profiles u
       ORDER BY u.last_active_at DESC`
    )
    .all(yearMonth) as JoinedRow[];

  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    avatarEmoji: r.avatar_emoji,
    role: (r.role as "admin" | "user") ?? "user",
    username: r.username,
    phone: r.phone,
    tier: (r.tier as "free" | "premium") ?? "free",
    tierExpiresAt: r.tier_expires_at,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
    registeredAt: r.registered_at,
    currentMonthUsage: r.current_month_usage ?? 0,
    accountLocked: r.account_locked_at !== null,
    passwordResetPending: r.password_reset_pending === 1,
  }));
}

/** 给某用户开通/续期会员。返回新的 expires_at（ms）。 */
export function grantPremium(userId: string, durationDays: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT tier_expires_at FROM user_profiles WHERE id = ?")
    .get(userId) as { tier_expires_at: number | null } | undefined;
  if (!row) throw new Error("user not found");

  const now = Date.now();
  const baseTime =
    row.tier_expires_at && row.tier_expires_at > now ? row.tier_expires_at : now;
  const newExpiresAt = baseTime + durationDays * 86_400_000;

  db.prepare(
    `UPDATE user_profiles
     SET tier = 'premium', tier_expires_at = ?
     WHERE id = ?`
  ).run(newExpiresAt, userId);

  return newExpiresAt;
}

/** 立即吊销会员。 */
export function revokePremium(userId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE user_profiles
     SET tier = 'free', tier_expires_at = NULL
     WHERE id = ?`
  ).run(userId);
}
