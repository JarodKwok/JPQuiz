import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE_NAME } from "@/lib/db/repos/auth-repo";

export async function POST() {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE_NAME)?.value;
  deleteSession(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
