import { NextRequest, NextResponse } from "next/server";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import { grantPremium } from "@/lib/db/repos/admin-users-repo";
import { logEvent } from "@/lib/db/repos/log-repo";
import { PLAN_PRICES, type PlanKey } from "@/lib/db/config";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

const VALID_PLANS: PlanKey[] = ["monthly", "yearly"];

export async function POST(
  req: NextRequest,
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
  const body = await req.json().catch(() => ({}));
  const planKey = body.plan as PlanKey;

  if (!VALID_PLANS.includes(planKey)) {
    return NextResponse.json(
      { error: "plan must be one of: " + VALID_PLANS.join(", ") },
      { status: 400 }
    );
  }
  const plan = PLAN_PRICES[planKey];

  const target = findAccountById(id);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  try {
    const newExpiresAt = grantPremium(id, plan.durationDays);
    logEvent({
      ownerId: adminId,
      category: "account",
      level: "info",
      message: `开通${plan.label}：用户 ${target.displayName}（${target.phone ?? "无手机号"}）`,
      metadata: {
        targetUserId: id,
        plan: planKey,
        durationDays: plan.durationDays,
        amountCents: plan.cents,
        newExpiresAt,
      },
    });
    return NextResponse.json({
      ok: true,
      tier: "premium",
      tierExpiresAt: newExpiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "grant failed" },
      { status: 500 }
    );
  }
}
