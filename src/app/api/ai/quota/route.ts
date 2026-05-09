import { NextResponse } from "next/server";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import {
  currentYearMonth,
  getMonthlyUsage,
} from "@/lib/db/repos/admin-config-repo";
import {
  FREE_MONTHLY_QUOTA,
  PREMIUM_MONTHLY_QUOTA,
} from "@/lib/db/config";
import {
  getServerUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

export async function GET() {
  let userId: string;
  try {
    userId = await getServerUserId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    throw err;
  }

  const account = findAccountById(userId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  const isPremium =
    account.tier === "premium" && (account.tierExpiresAt ?? 0) > Date.now();
  const monthlyQuota = isPremium ? PREMIUM_MONTHLY_QUOTA : FREE_MONTHLY_QUOTA;
  const yearMonth = currentYearMonth();
  const used = getMonthlyUsage(userId, yearMonth);
  const remaining = Math.max(0, monthlyQuota - used);
  const enabled = remaining > 0;

  return NextResponse.json({
    enabled,           // 客户端只看这个：true=入口可见，false=入口隐藏
    isPremium,
    expiresAt: account.tierExpiresAt,
    // 以下字段仅给后台/调试用，客户端 UI 不展示
    monthlyQuota,
    used,
    remaining,
    yearMonth,
  });
}
