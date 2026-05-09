import { NextRequest, NextResponse } from "next/server";
import {
  findAccountByUsername,
  getSecurityQuestion,
} from "@/lib/db/repos/auth-repo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) {
      return NextResponse.json({ error: "请输入用户名" }, { status: 400 });
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

    const question = getSecurityQuestion(username);
    if (!question) {
      return NextResponse.json(
        { error: "该账号未设置密保问题，请联系管理员" },
        { status: 400 }
      );
    }

    return NextResponse.json({ question });
  } catch (err) {
    console.error("[auth/forgot/start]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
