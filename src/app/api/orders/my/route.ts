import { NextResponse } from "next/server";
import { listMyOrders } from "@/lib/db/repos/subscription-repo";
import { getServerUserId, UnauthorizedError } from "@/lib/db/server-user";

export async function GET() {
  try {
    const userId = await getServerUserId();
    return NextResponse.json({ orders: listMyOrders(userId) });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    throw err;
  }
}
