import { NextRequest, NextResponse } from "next/server";
import { cancelOrder, getOrderById } from "@/lib/db/repos/subscription-repo";
import { logEvent } from "@/lib/db/repos/log-repo";
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

  const ok = cancelOrder(orderId, adminId);
  if (!ok) {
    return NextResponse.json(
      { error: `订单当前状态为 ${order.status}，无法作废` },
      { status: 400 }
    );
  }

  logEvent({
    ownerId: adminId,
    category: "account",
    level: "warn",
    message: `作废订单 ${orderId}（用户 ${order.displayName}）`,
    metadata: { orderId, targetUserId: order.userId },
  });
  return NextResponse.json({ ok: true });
}
