import { NextRequest, NextResponse } from "next/server";
import {
  findAccountById,
  updateCredentials,
} from "@/lib/db/repos/auth-repo";
import { getServerUserId, UnauthorizedError } from "@/lib/db/server-user";
import { PASSWORD_MIN_LENGTH } from "@/lib/db/config";

export async function POST(req: NextRequest) {
  try {
    let userId: string;
    try {
      userId = await getServerUserId();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      }
      throw err;
    }

    const account = findAccountById(userId);
    if (!account) {
      return NextResponse.json({ error: "账户不存在" }, { status: 404 });
    }
    // 仅在 password_reset_pending=1 时允许用此端点
    if (!account.passwordResetPending) {
      return NextResponse.json(
        { error: "无重置标记，请走「忘记密码」流程" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const securityQuestion =
      typeof body.securityQuestion === "string" ? body.securityQuestion : "";
    const securityAnswer =
      typeof body.securityAnswer === "string" ? body.securityAnswer : "";

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${PASSWORD_MIN_LENGTH} 位` },
        { status: 400 }
      );
    }
    if (!securityQuestion.trim() || !securityAnswer.trim()) {
      return NextResponse.json(
        { error: "请同时设置新的密保问题和答案" },
        { status: 400 }
      );
    }

    const result = updateCredentials(userId, password, securityQuestion, securityAnswer);
    if (!result.ok) {
      return NextResponse.json({ error: "密码不合法" }, { status: 400 });
    }

    const refreshed = findAccountById(userId);
    return NextResponse.json({ account: refreshed });
  } catch (err) {
    console.error("[auth/reset-after-approval]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
