import { NextRequest, NextResponse } from "next/server";
import { rejectResetRequest } from "@/lib/db/repos/auth-repo";
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

  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const result = rejectResetRequest(requestId, adminId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "申请不存在或已处理" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
