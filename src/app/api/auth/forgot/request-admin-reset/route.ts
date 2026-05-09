import { NextRequest, NextResponse } from "next/server";
import {
  findAccountByUsername,
  lockAccount,
  submitResetRequest,
} from "@/lib/db/repos/auth-repo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const message = typeof body.message === "string" ? body.message : "";

    if (!username) {
      return NextResponse.json({ error: "请输入用户名" }, { status: 400 });
    }
    if (!message.trim()) {
      return NextResponse.json(
        { error: "请填写联系方式或留言，便于管理员核实" },
        { status: 400 }
      );
    }

    const account = findAccountByUsername(username);
    if (!account) {
      return NextResponse.json({ error: "该用户名不存在" }, { status: 404 });
    }

    // 已锁定不变；未锁定也可以主动锁（用户主动求助意味着自己进不去）
    if (!account.accountLocked) {
      lockAccount(account.id);
    }

    const request = submitResetRequest(account.id, message);
    if (!request) {
      return NextResponse.json({ error: "提交失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requestId: request.id });
  } catch (err) {
    console.error("[auth/forgot/request-admin-reset]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
