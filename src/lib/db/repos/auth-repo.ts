import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "../sqlite";
import {
  MAX_RECOVERY_ATTEMPTS,
  PASSWORD_MIN_LENGTH,
  USERNAME_REGEX,
} from "../config";

export const SESSION_COOKIE_NAME = "jpquiz-sid";
export const RESET_COOKIE_NAME = "jpquiz-reset";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const BCRYPT_COST = 10;

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

// ── Sessions ──────────────────────────────────────────────────────────────

export interface CreateSessionResult {
  id: string;
  expiresAt: number;
}

export function createSession(userId: string, userAgent?: string): CreateSessionResult {
  const db = getDb();
  const id = generateSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    `INSERT INTO sessions (id, user_id, user_agent, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, userAgent ?? null, now, expiresAt);
  return { id, expiresAt };
}

export function getSessionUserId(sessionId: string | undefined | null): string | null {
  if (!sessionId) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { user_id: string; expires_at: number } | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
  return row.user_id;
}

/**
 * 滚动续期：把 session expires_at 推到 now + TTL。
 * 只在 /api/auth/me 这种「确认用户活跃」的端点调用，避免每次请求都写 DB。
 */
export function refreshSessionExpiry(sessionId: string): number | null {
  const db = getDb();
  const row = db
    .prepare("SELECT expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { expires_at: number } | undefined;
  if (!row) return null;

  const newExpires = Date.now() + SESSION_TTL_MS;
  if (newExpires - row.expires_at > 86_400_000) {
    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpires, sessionId);
    return newExpires;
  }
  return row.expires_at;
}

export function deleteSession(sessionId: string | undefined | null): void {
  if (!sessionId) return;
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function purgeExpiredSessions(): number {
  const db = getDb();
  return db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now()).changes;
}

// ── 用户名 / 密码 / 密保 哈希工具 ─────────────────────────────────────────

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function isUsernameTaken(username: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM user_profiles WHERE username = ? LIMIT 1")
    .get(username);
  return !!row;
}

/** 生成 user_xxxxxx（6 位 base36）建议用户名，避开冲突。 */
export function suggestUsername(): string {
  for (let i = 0; i < 8; i++) {
    const suffix = randomBytes(4).toString("hex").slice(0, 6);
    const candidate = `user_${suffix}`;
    if (!isUsernameTaken(candidate)) return candidate;
  }
  // 极端情况下退而用 uuid 前 8 位
  return `user_${randomUUID().slice(0, 8)}`;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function hashSecurityAnswer(answer: string): string {
  return bcrypt.hashSync(normalizeAnswer(answer), BCRYPT_COST);
}

export function verifySecurityAnswer(answer: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(normalizeAnswer(answer), hash);
  } catch {
    return false;
  }
}

// ── 账户读 / 注册 / 登录 ─────────────────────────────────────────────────

export interface AuthAccount {
  id: string;
  displayName: string;
  avatarEmoji: string;
  role: "admin" | "user";
  username: string | null;
  phone: string | null;
  tier: "free" | "premium";
  tierExpiresAt: number | null;
  createdAt: string;
  registeredAt: number | null;
  passwordResetPending: boolean;
  accountLocked: boolean;
  securityQuestion: string | null;
}

interface AccountRow {
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
  password_hash: string | null;
  security_question: string | null;
  security_answer_hash: string | null;
  failed_recovery_attempts: number;
  account_locked_at: number | null;
  password_reset_pending: number;
}

function rowToAccount(row: AccountRow): AuthAccount {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    role: row.role as "admin" | "user",
    username: row.username,
    phone: row.phone,
    tier: (row.tier as "free" | "premium") ?? "free",
    tierExpiresAt: row.tier_expires_at,
    createdAt: row.created_at,
    registeredAt: row.registered_at,
    passwordResetPending: row.password_reset_pending === 1,
    accountLocked: row.account_locked_at !== null,
    securityQuestion: row.security_question,
  };
}

export function findAccountById(userId: string): AuthAccount | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM user_profiles WHERE id = ?").get(userId) as
    | AccountRow
    | undefined;
  return row ? rowToAccount(row) : null;
}

function findAccountRowByUsername(username: string): AccountRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM user_profiles WHERE username = ?")
    .get(username) as AccountRow | undefined;
  return row ?? null;
}

export function findAccountByUsername(username: string): AuthAccount | null {
  const row = findAccountRowByUsername(username);
  return row ? rowToAccount(row) : null;
}

export interface RegisterInput {
  username: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  displayName?: string;
  avatarEmoji?: string;
}

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_username" | "username_taken" | "weak_password" | "missing_fields" };

/** 创建新账户（密码 + 密保）。第一个真实用户自动 admin。 */
export function registerAccount(input: RegisterInput): RegisterResult {
  const username = input.username.trim();
  if (!isValidUsername(username)) {
    return { ok: false, reason: "invalid_username" };
  }
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: "weak_password" };
  }
  if (!input.securityQuestion.trim() || !input.securityAnswer.trim()) {
    return { ok: false, reason: "missing_fields" };
  }
  if (isUsernameTaken(username)) {
    return { ok: false, reason: "username_taken" };
  }

  const db = getDb();
  const realUserCount = (db
    .prepare("SELECT COUNT(*) AS n FROM user_profiles WHERE id != 'local-default'")
    .get() as { n: number }).n;
  const role = realUserCount === 0 ? "admin" : "user";

  const id = randomUUID();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const displayName = (input.displayName?.trim() || username).slice(0, 32);
  const avatarEmoji = input.avatarEmoji || "🌸";

  db.prepare(
    `INSERT INTO user_profiles
       (id, display_name, avatar_emoji, role, created_at, last_active_at,
        username, phone, tier, tier_expires_at, registered_at,
        password_hash, security_question, security_answer_hash,
        failed_recovery_attempts, account_locked_at, password_reset_pending)
     VALUES (?, ?, ?, ?, ?, ?,
             ?, NULL, 'free', NULL, ?,
             ?, ?, ?,
             0, NULL, 0)`
  ).run(
    id,
    displayName,
    avatarEmoji,
    role,
    nowIso,
    nowIso,
    username,
    nowMs,
    hashPassword(input.password),
    input.securityQuestion.trim().slice(0, 200),
    hashSecurityAnswer(input.securityAnswer)
  );

  return { ok: true, userId: id };
}

export type LoginResult =
  | { ok: true; userId: string; passwordResetPending: boolean }
  | { ok: false; reason: "invalid" | "locked" };

/** 用户名 + 密码 校验。返回 ok 时附带 password_reset_pending，调用方决定是否跳转重设页。 */
export function loginByPassword(username: string, password: string): LoginResult {
  const row = findAccountRowByUsername(username.trim());
  if (!row || !row.password_hash) {
    return { ok: false, reason: "invalid" };
  }

  // 已被 admin 批准重置：放行登录但标记 pending，让前端跳到强制重设页
  // 任意密码都允许通过（用户可能就是因为忘了才被批准）
  if (row.password_reset_pending === 1) {
    return { ok: true, userId: row.id, passwordResetPending: true };
  }

  // 锁定状态：禁止登录（哪怕密码对）
  if (row.account_locked_at !== null) {
    return { ok: false, reason: "locked" };
  }

  if (!verifyPassword(password, row.password_hash)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, userId: row.id, passwordResetPending: false };
}

export function touchLastActive(userId: string): void {
  const db = getDb();
  db.prepare("UPDATE user_profiles SET last_active_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    userId
  );
}

// ── 密保 / 锁账户 / 重置 流程 ─────────────────────────────────────────────

export function getSecurityQuestion(username: string): string | null {
  const row = findAccountRowByUsername(username.trim());
  if (!row) return null;
  if (row.account_locked_at !== null) return null; // 锁定时不暴露问题
  return row.security_question;
}

/** 答错 +1，达到 MAX_RECOVERY_ATTEMPTS 自动锁账户。返回当前 attempts 与是否触发锁定。 */
export function incrementRecoveryFailure(userId: string): {
  attempts: number;
  locked: boolean;
} {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT failed_recovery_attempts FROM user_profiles WHERE id = ?"
    )
    .get(userId) as { failed_recovery_attempts: number } | undefined;
  if (!row) return { attempts: 0, locked: false };

  const next = row.failed_recovery_attempts + 1;
  const shouldLock = next >= MAX_RECOVERY_ATTEMPTS;
  if (shouldLock) {
    db.prepare(
      "UPDATE user_profiles SET failed_recovery_attempts = ?, account_locked_at = ? WHERE id = ?"
    ).run(next, Date.now(), userId);
  } else {
    db.prepare(
      "UPDATE user_profiles SET failed_recovery_attempts = ? WHERE id = ?"
    ).run(next, userId);
  }
  return { attempts: next, locked: shouldLock };
}

export function resetRecoveryFailures(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE user_profiles SET failed_recovery_attempts = 0 WHERE id = ?"
  ).run(userId);
}

export function lockAccount(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE user_profiles SET account_locked_at = ? WHERE id = ?"
  ).run(Date.now(), userId);
}

export function unlockAccount(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE user_profiles SET account_locked_at = NULL, failed_recovery_attempts = 0 WHERE id = ?"
  ).run(userId);
}

export function setPasswordResetPending(userId: string, pending: boolean): void {
  const db = getDb();
  db.prepare(
    "UPDATE user_profiles SET password_reset_pending = ? WHERE id = ?"
  ).run(pending ? 1 : 0, userId);
}

/** 设新密码 + 可选改密保。同时清掉 lock / pending / failure 计数。 */
export function updateCredentials(
  userId: string,
  newPassword: string,
  newSecurityQuestion?: string,
  newSecurityAnswer?: string
): { ok: boolean; reason?: "weak_password" } {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: "weak_password" };
  }
  const db = getDb();

  if (newSecurityQuestion !== undefined && newSecurityAnswer !== undefined) {
    db.prepare(
      `UPDATE user_profiles
         SET password_hash = ?,
             security_question = ?,
             security_answer_hash = ?,
             failed_recovery_attempts = 0,
             account_locked_at = NULL,
             password_reset_pending = 0
       WHERE id = ?`
    ).run(
      hashPassword(newPassword),
      newSecurityQuestion.trim().slice(0, 200),
      hashSecurityAnswer(newSecurityAnswer),
      userId
    );
  } else {
    db.prepare(
      `UPDATE user_profiles
         SET password_hash = ?,
             failed_recovery_attempts = 0,
             account_locked_at = NULL,
             password_reset_pending = 0
       WHERE id = ?`
    ).run(hashPassword(newPassword), userId);
  }
  return { ok: true };
}

// ── 留言箱（password_reset_requests） ────────────────────────────────────

export interface PasswordResetRequest {
  id: number;
  userId: string;
  username: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  processedAt: number | null;
  processedBy: string | null;
}

interface ResetRequestRow {
  id: number;
  user_id: string;
  username: string;
  message: string | null;
  status: string;
  created_at: number;
  processed_at: number | null;
  processed_by: string | null;
}

function rowToRequest(row: ResetRequestRow): PasswordResetRequest {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message,
    status: row.status as "pending" | "approved" | "rejected",
    createdAt: row.created_at,
    processedAt: row.processed_at,
    processedBy: row.processed_by,
  };
}

/** 写入留言申请。同一用户已有 pending 申请时不再重复写。 */
export function submitResetRequest(userId: string, message: string): PasswordResetRequest | null {
  const db = getDb();
  const account = findAccountById(userId);
  if (!account || !account.username) return null;

  const existing = db
    .prepare(
      "SELECT * FROM password_reset_requests WHERE user_id = ? AND status = 'pending' LIMIT 1"
    )
    .get(userId) as ResetRequestRow | undefined;
  if (existing) {
    // 复用旧请求，但允许更新留言（覆盖）
    db.prepare("UPDATE password_reset_requests SET message = ? WHERE id = ?").run(
      message.trim().slice(0, 500),
      existing.id
    );
    const updated = db
      .prepare("SELECT * FROM password_reset_requests WHERE id = ?")
      .get(existing.id) as ResetRequestRow;
    return rowToRequest(updated);
  }

  const info = db
    .prepare(
      `INSERT INTO password_reset_requests
         (user_id, username, message, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    )
    .run(userId, account.username, message.trim().slice(0, 500), Date.now());
  const row = db
    .prepare("SELECT * FROM password_reset_requests WHERE id = ?")
    .get(info.lastInsertRowid) as ResetRequestRow;
  return rowToRequest(row);
}

export function listPendingResetRequests(): PasswordResetRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM password_reset_requests WHERE status = 'pending' ORDER BY created_at ASC"
    )
    .all() as ResetRequestRow[];
  return rows.map(rowToRequest);
}

export function listAllResetRequests(limit = 50): PasswordResetRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM password_reset_requests ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as ResetRequestRow[];
  return rows.map(rowToRequest);
}

export function countPendingResetRequests(): number {
  const db = getDb();
  return (db
    .prepare("SELECT COUNT(*) AS n FROM password_reset_requests WHERE status = 'pending'")
    .get() as { n: number }).n;
}

/** 批准：解锁 + 设 password_reset_pending=1（不直接改密码）。 */
export function approveResetRequest(
  requestId: number,
  adminId: string
): { ok: boolean; userId?: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM password_reset_requests WHERE id = ? AND status = 'pending'")
    .get(requestId) as ResetRequestRow | undefined;
  if (!row) return { ok: false };

  const now = Date.now();
  db.prepare(
    `UPDATE password_reset_requests
       SET status = 'approved', processed_at = ?, processed_by = ?
     WHERE id = ?`
  ).run(now, adminId, requestId);

  // 解锁 + 设 pending；用户下次任意密码登录将进强制重设页
  db.prepare(
    `UPDATE user_profiles
       SET account_locked_at = NULL,
           failed_recovery_attempts = 0,
           password_reset_pending = 1
     WHERE id = ?`
  ).run(row.user_id);

  return { ok: true, userId: row.user_id };
}

/** 驳回：仅标 status=rejected，不解锁，账户仍处于锁定。 */
export function rejectResetRequest(
  requestId: number,
  adminId: string
): { ok: boolean } {
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE password_reset_requests
         SET status = 'rejected', processed_at = ?, processed_by = ?
       WHERE id = ? AND status = 'pending'`
    )
    .run(Date.now(), adminId, requestId);
  return { ok: info.changes > 0 };
}
