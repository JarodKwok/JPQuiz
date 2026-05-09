import { NextRequest, NextResponse } from "next/server";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import { grantPremium } from "@/lib/db/repos/admin-users-repo";
import {
  getOrderById,
  markOrderActivated,
} from "@/lib/db/repos/subscription-repo";
import { logEvent } from "@/lib/db/repos/log-repo";
import { PLAN_PRICES } from "@/lib/db/config";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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

  const { id: orderId } = await ctx.params;
  const order = getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (order.status !== "pending" && order.status !== "paid") {
    return NextResponse.json(
      { error: `订单当前状态为 ${order.status}，无法激活` },
      { status: 400 }
    );
  }

  const target = findAccountById(order.userId);
  if (!target) {
    return NextResponse.json({ error: "订单关联的用户不存在" }, { status: 404 });
  }

  const plan = PLAN_PRICES[order.plan];
  const newExpiresAt = grantPremium(order.userId, plan.durationDays);
  const ok = markOrderActivated(orderId, adminId);
  if (!ok) {
    return NextResponse.json({ error: "订单状态写入失败" }, { status: 500 });
  }

  logEvent({
    ownerId: adminId,
    category: "account",
    level: "info",
    message: `激活订单 ${orderId}：用户 ${target.displayName}（${plan.label}）`,
    metadata: {
      orderId,
      targetUserId: order.userId,
      plan: order.plan,
      durationDays: plan.durationDays,
      amountCents: order.amountCents,
      newExpiresAt,
    },
  });

  return NextResponse.json({ ok: true, tierExpiresAt: newExpiresAt });
}
