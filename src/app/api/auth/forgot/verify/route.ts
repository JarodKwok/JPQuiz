import { NextRequest, NextResponse } from "next/server";
import {
  findAccountByUsername,
  incrementRecoveryFailure,
  resetRecoveryFailures,
  RESET_COOKIE_NAME,
  verifySecurityAnswer,
} from "@/lib/db/repos/auth-repo";
import { getDb } from "@/lib/db/sqlite";
import { issueResetToken } from "@/lib/db/reset-token";
import { MAX_RECOVERY_ATTEMPTS, RESET_TOKEN_TTL_MS } from "@/lib/db/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer : "";

    if (!username || !answer) {
      return NextResponse.json({ error: "请输入答案" }, { status: 400 });
    }

    const account = findAccountByUsername(username);
    if (!account) {
      return NextResponse.json({ error: "该用户名不存在" }, { status: 404 });
    }
    if (account.accountLocked) {
      return NextResponse.json(
        { error: "账号已锁定", reason: "locked" },
        { status: 423 }
      );
    }

    // 直接读 hash 列（auth-repo 没暴露，需要在这查一次）
    const row = getDb()
      .prepare("SELECT security_answer_hash FROM user_profiles WHERE id = ?")
      .get(account.id) as { security_answer_hash: string | null } | undefined;
    const passed = verifySecurityAnswer(answer, row?.security_answer_hash);

    if (!passed) {
      const result = incrementRecoveryFailure(account.id);
      if (result.locked) {
        return NextResponse.json(
          { error: "答案错误次数过多，账号已锁定", reason: "locked" },
          { status: 423 }
        );
      }
      const remaining = MAX_RECOVERY_ATTEMPTS - result.attempts;
      return NextResponse.json(
        {
          error: `答案错误，剩余 ${remaining} 次机会`,
          reason: "wrong_answer",
          attemptsRemaining: remaining,
        },
        { status: 400 }
      );
    }

    // 答对：清失败计数 + 签发短期 reset token
    resetRecoveryFailures(account.id);
    const token = issueResetToken(account.id);

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: RESET_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(RESET_TOKEN_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    console.error("[auth/forgot/verify]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
