import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findAccountById,
  registerAccount,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/db/repos/auth-repo";
import { PASSWORD_MIN_LENGTH } from "@/lib/db/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const securityQuestion =
      typeof body.securityQuestion === "string" ? body.securityQuestion : "";
    const securityAnswer =
      typeof body.securityAnswer === "string" ? body.securityAnswer : "";
    const displayName =
      typeof body.displayName === "string" ? body.displayName : undefined;
    const avatarEmoji =
      typeof body.avatarEmoji === "string" ? body.avatarEmoji : undefined;

    const result = registerAccount({
      username,
      password,
      securityQuestion,
      securityAnswer,
      displayName,
      avatarEmoji,
    });

    if (!result.ok) {
      const messageMap: Record<string, string> = {
        invalid_username: "用户名格式不合法（3-20 位字母 / 数字 / 下划线）",
        username_taken: "用户名已被占用",
        weak_password: `密码至少 ${PASSWORD_MIN_LENGTH} 位`,
        missing_fields: "密保问题和答案均不能为空",
      };
      return NextResponse.json(
        { error: messageMap[result.reason] ?? "注册失败" },
        { status: 400 }
      );
    }

    const account = findAccountById(result.userId);
    const session = createSession(
      result.userId,
      req.headers.get("user-agent") || undefined
    );

    const res = NextResponse.json({ account });
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
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
