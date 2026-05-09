import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSession,
  findAccountById,
  RESET_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  updateCredentials,
} from "@/lib/db/repos/auth-repo";
import { verifyResetToken } from "@/lib/db/reset-token";
import { PASSWORD_MIN_LENGTH } from "@/lib/db/config";

export async function POST(req: NextRequest) {
  try {
    const c = await cookies();
    const token = c.get(RESET_COOKIE_NAME)?.value;
    const userId = verifyResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "重置凭证已失效，请重新走「忘记密码」流程" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const newSecurityQuestion =
      typeof body.securityQuestion === "string" ? body.securityQuestion : undefined;
    const newSecurityAnswer =
      typeof body.securityAnswer === "string" ? body.securityAnswer : undefined;

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${PASSWORD_MIN_LENGTH} 位` },
        { status: 400 }
      );
    }

    // 改密保必须 question + answer 同时给
    let updateQ: string | undefined;
    let updateA: string | undefined;
    if (newSecurityQuestion && newSecurityAnswer) {
      updateQ = newSecurityQuestion;
      updateA = newSecurityAnswer;
    }

    const result = updateCredentials(userId, password, updateQ, updateA);
    if (!result.ok) {
      return NextResponse.json({ error: "密码不合法" }, { status: 400 });
    }

    // 重置成功后自动登录 + 销毁 reset cookie
    const account = findAccountById(userId);
    const session = createSession(userId, req.headers.get("user-agent") || undefined);

    const res = NextResponse.json({ account });
    res.cookies.delete(RESET_COOKIE_NAME);
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
    console.error("[auth/forgot/reset]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
