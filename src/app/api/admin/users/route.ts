import { NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/db/repos/admin-users-repo";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";
import {
  FREE_MONTHLY_QUOTA,
  PREMIUM_MONTHLY_QUOTA,
} from "@/lib/db/config";

export async function GET() {
  try {
    await requireAdminUserId();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    throw err;
  }

  const now = Date.now();
  const users = listAdminUsers().map((u) => {
    const isPremium = u.tier === "premium" && (u.tierExpiresAt ?? 0) > now;
    const monthlyQuota = isPremium ? PREMIUM_MONTHLY_QUOTA : FREE_MONTHLY_QUOTA;
    return {
      ...u,
      isPremium,
      monthlyQuota,
      remaining: Math.max(0, monthlyQuota - u.currentMonthUsage),
    };
  });
  return NextResponse.json({ users });
}
