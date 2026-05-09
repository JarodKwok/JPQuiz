import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  findAccountById,
  getSessionUserId,
  refreshSessionExpiry,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  touchLastActive,
} from "@/lib/db/repos/auth-repo";

export async function GET() {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE_NAME)?.value;
  const userId = getSessionUserId(sid);
  if (!userId) return NextResponse.json({ account: null });

  const account = findAccountById(userId);
  if (!account) return NextResponse.json({ account: null });

  touchLastActive(userId);

  // 滚动续期：每次 me 调用把 cookie maxAge 重置回 30 天，
  // 等效"只要每月用一次就永远不掉线"
  refreshSessionExpiry(sid!);
  const res = NextResponse.json({ account });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sid!,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
