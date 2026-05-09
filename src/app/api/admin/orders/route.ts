import { NextResponse } from "next/server";
import { countPendingOrders, listOrders } from "@/lib/db/repos/subscription-repo";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "pending";
  const orders = listOrders(scope);
  const pendingCount = countPendingOrders();
  return NextResponse.json({ orders, pendingCount });
}
