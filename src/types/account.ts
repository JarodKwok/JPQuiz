export type AccountRole = "admin" | "user";
export type AccountTier = "free" | "premium";

export interface UserProfile {
  id: string; // UUID v4, or "local-default" for legacy
  displayName: string;
  avatarEmoji: string; // default "🌸"
  role: AccountRole;
  createdAt: string;
  lastActiveAt: string;
  // 新认证体系字段（老 IndexedDB 数据 / local-default 没有，可缺省）
  username?: string | null;
  phone?: string | null;
  tier?: AccountTier;
  tierExpiresAt?: number | null;
  passwordResetPending?: boolean;
  accountLocked?: boolean;
  securityQuestion?: string | null;
}
