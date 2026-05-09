import { cookies } from "next/headers";
import { findAccountById, getSessionUserId, SESSION_COOKIE_NAME } from "./repos/auth-repo";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthenticated");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

/** 当前登录用户 ID。Session 缺失或过期时抛 UnauthorizedError。 */
export async function getServerUserId(): Promise<string> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const userId = getSessionUserId(sid);
  if (!userId) throw new UnauthorizedError();
  return userId;
}

/** 当前登录用户 ID，且必须是管理员。否则抛对应错误。 */
export async function requireAdminUserId(): Promise<string> {
  const userId = await getServerUserId();
  const account = findAccountById(userId);
  if (!account || account.role !== "admin") throw new ForbiddenError();
  return userId;
}
