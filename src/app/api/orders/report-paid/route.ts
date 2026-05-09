import { NextRequest, NextResponse } from "next/server";
import { createOrReuseOrder, type PaymentChannel } from "@/lib/db/repos/subscription-repo";
import { getServerUserId, UnauthorizedError } from "@/lib/db/server-user";
import { PLAN_PRICES, type PlanKey } from "@/lib/db/config";
import { logEvent } from "@/lib/db/repos/log-repo";

const VALID_PLANS: PlanKey[] = ["monthly", "yearly"];
const VALID_CHANNELS: PaymentChannel[] = ["alipay", "wechat", "other"];

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getServerUserId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    throw err;
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan as PlanKey;
  const paymentChannel = body.paymentChannel as PaymentChannel;
  const userNote = typeof body.userNote === "string" ? body.userNote : "";

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "请选择套餐" }, { status: 400 });
  }
  if (!VALID_CHANNELS.includes(paymentChannel)) {
    return NextResponse.json({ error: "请选择支付通道" }, { status: 400 });
  }
  if (!userNote.trim()) {
    return NextResponse.json(
      { error: "请填写付款备注（金额尾号 + 付款时间），便于核对" },
      { status: 400 }
    );
  }

  try {
    const order = createOrReuseOrder({ userId, plan, paymentChannel, userNote });
    logEvent({
      ownerId: userId,
      category: "account",
      level: "info",
      message: `用户报付：订单 ${order.id}（${PLAN_PRICES[plan].label}，${paymentChannel}）`,
      metadata: { orderId: order.id, plan, paymentChannel },
    });
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "提交失败" },
      { status: 500 }
    );
  }
}
