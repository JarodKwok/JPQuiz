"use client";

import type { UserProfile } from "@/types/account";
import { logEvent } from "@/services/systemLog";

const DEFAULT_OWNER_ID = "local-default";

// 当前登录用户 ID 的同步缓存。session-based 认证下，真正的 source of truth
// 是 HttpOnly cookie + 服务端 sessions 表；客户端通过 fetchCurrentUser() 把
// 用户 ID 拉过来缓存到这里，供 lessonStore / ai/memory 等同步使用方读取。
let _cachedUserId: string = DEFAULT_OWNER_ID;

/** 同步读取当前用户 ID（用于 localStorage 命名空间等场景）。
 *  调用前必须先 fetchCurrentUser() 把缓存填好；否则返回 DEFAULT_OWNER_ID。
 */
export function getCurrentUserId(): string {
  return _cachedUserId;
}

function setCachedUserId(userId: string) {
  _cachedUserId = userId;
}

/** 从服务端拉取当前会话对应的账户。返回 null 表示未登录。 */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.account) {
      setCachedUserId(data.account.id);
      return data.account as UserProfile;
    }
    return null;
  } catch {
    return null;
  }
}

/** 退出登录：清除服务端 session 并跳转到 /login */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  setCachedUserId(DEFAULT_OWNER_ID);
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/** 列出所有账户 */
export async function listAccounts(): Promise<UserProfile[]> {
  const res = await fetch("/api/db/account/list");
  if (!res.ok) return [];
  return res.json();
}

/** 获取指定账户 */
export async function getAccount(
  userId: string
): Promise<UserProfile | undefined> {
  const res = await fetch(`/api/db/account/get?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data || undefined;
}

/** 创建新账户 */
export async function createAccount(
  displayName: string,
  avatarEmoji = "🌸",
  role: "admin" | "user" = "user"
): Promise<UserProfile> {
  const id = crypto.randomUUID();
  const res = await fetch("/api/db/account/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, displayName, avatarEmoji, role }),
  });
  if (!res.ok) throw new Error("Failed to create account");
  const profile: UserProfile = await res.json();

  void logEvent("account", "info", `创建账户「${displayName}」(${role})`, {
    userId: profile.id,
    role,
  });
  return profile;
}

/** 用户自主注册（固定为普通用户） */
export async function registerAccount(
  displayName: string,
  avatarEmoji = "🌸"
): Promise<UserProfile> {
  return createAccount(displayName, avatarEmoji, "user");
}

/** 判断当前用户是否为管理员 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getAccount(getCurrentUserId());
  return profile?.role === "admin";
}

/**
 * @deprecated 多账户切换在 session-based 认证下已不再适用。
 * 调用此函数会执行登出，让用户回到 /login 用目标账户的手机号重新登录。
 */
export async function switchAccount(_userId: string): Promise<void> {
  await logout();
}

/** 删除账户及其所有数据。删自己时会自动 logout。 */
export async function deleteAccount(userId: string): Promise<void> {
  const deletedProfile = await getAccount(userId);
  void logEvent("account", "warn", `删除账户「${deletedProfile?.displayName ?? userId}」`, {
    userId,
  });

  await fetch("/api/db/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (userId === getCurrentUserId()) {
    await logout();
  }
}

/** 更新账户信息 */
export async function updateAccount(
  userId: string,
  changes: Partial<Pick<UserProfile, "displayName" | "avatarEmoji">>
): Promise<void> {
  await fetch("/api/db/account/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...changes }),
  });
}

/**
 * 将 local-default 的全部数据迁移到新用户。
 * 迁移后删除 local-default profile。
 */
export async function migrateLocalDefaultToUser(
  newUserId: string
): Promise<void> {
  await fetch("/api/db/account/migrate-default", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newUserId }),
  });

  // 迁移 localStorage keys
  const legacyKeys = [
    "jpquiz-current-lesson",
    "jpquiz-current-module",
    "jpquiz-active-ai-conversation",
  ];
  for (const key of legacyKeys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      localStorage.setItem(key.replace("jpquiz-", `jpquiz-${newUserId}-`), value);
      localStorage.removeItem(key);
    }
  }
}

/**
 * 将一个用户的全部学习数据迁移到另一个用户。
 * 源用户的数据会被移动（不保留副本）。
 */
export async function transferAccountData(
  fromUserId: string,
  toUserId: string
): Promise<number> {
  const res = await fetch("/api/db/account/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromUserId, toUserId }),
  });
  if (!res.ok) throw new Error("Transfer failed");
  const data = await res.json();
  const total = data.total as number;

  // 迁移 localStorage keys
  const keyPrefixes = ["current-lesson", "current-module", "active-ai-conversation"];
  for (const suffix of keyPrefixes) {
    const fromKey = `jpquiz-${fromUserId}-${suffix}`;
    const value = localStorage.getItem(fromKey);
    if (value !== null) {
      const toKey = `jpquiz-${toUserId}-${suffix}`;
      if (localStorage.getItem(toKey) === null) {
        localStorage.setItem(toKey, value);
      }
      localStorage.removeItem(fromKey);
    }
  }

  void logEvent("account", "info",
    `数据迁移: 共 ${total} 条记录`,
    { fromUserId, toUserId, total }
  );

  return total;
}

/** 检查是否需要首次引导（仅存在 local-default 且无真实账户） */
export async function needsAccountSetup(): Promise<boolean> {
  const res = await fetch("/api/db/account/needs-setup");
  if (!res.ok) return false;
  const data = await res.json();
  return data.needsSetup;
}
