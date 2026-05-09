import { NextRequest, NextResponse } from "next/server";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import { revokePremium } from "@/lib/db/repos/admin-users-repo";
import { logEvent } from "@/lib/db/repos/log-repo";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminId: string;
  try {
    adminId = await requireAdminUserId();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const target = findAccountById(id);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  try {
    revokePremium(id);
    logEvent({
      ownerId: adminId,
      category: "account",
      level: "warn",
      message: `禁用 AI 会员：用户 ${target.displayName}（${target.phone ?? "无手机号"}）`,
      metadata: { targetUserId: id, previousTier: target.tier },
    });
    return NextResponse.json({ ok: true, tier: "free", tierExpiresAt: null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "revoke failed" },
      { status: 500 }
    );
  }
}
