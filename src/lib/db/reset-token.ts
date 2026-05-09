import { createHmac, randomBytes } from "crypto";
import { RESET_TOKEN_TTL_MS } from "./config";

/**
 * 忘记密码流程的临时凭证。
 * 用 HMAC 签名 userId + expires 编入 cookie；服务端无须存表，5 分钟过期失效。
 *
 * Secret 优先取 env 变量；缺省时自动生成进程内随机密钥（重启失效，可接受 —— 反正
 * 这条 cookie 5 分钟有效，没人能在重启间隙跨进程复用）。
 */
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env = process.env.JPQUIZ_AUTH_SECRET;
  cachedSecret = env && env.length >= 16 ? env : randomBytes(32).toString("hex");
  return cachedSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issueResetToken(userId: string): string {
  const expires = Date.now() + RESET_TOKEN_TTL_MS;
  const payload = `${userId}.${expires}`;
  const sig = sign(payload);
  // base64url-ish without "=" padding
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyResetToken(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiresStr, sig] = parts;
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || expires < Date.now()) return null;
    const expected = sign(`${userId}.${expires}`);
    // 等长不变时间比较
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) return null;
    return userId;
  } catch {
    return null;
  }
}
