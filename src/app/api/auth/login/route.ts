import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findAccountById,
  loginByPassword,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/db/repos/auth-repo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    const result = loginByPassword(username, password);
    if (!result.ok) {
      const messageMap: Record<string, string> = {
        invalid: "用户名或密码错误",
        locked: "账号已锁定，请通过「忘记密码」提交重置申请",
      };
      return NextResponse.json(
        { error: messageMap[result.reason], reason: result.reason },
        { status: 401 }
      );
    }

    const account = findAccountById(result.userId);
    const session = createSession(
      result.userId,
      req.headers.get("user-agent") || undefined
    );

    const res = NextResponse.json({
      account,
      passwordResetPending: result.passwordResetPending,
    });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.id,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
