import { NextRequest, NextResponse } from "next/server";
import { findAccountById } from "@/lib/db/repos/auth-repo";
import { logEvent } from "@/lib/db/repos/log-repo";
import { getDb } from "@/lib/db/sqlite";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

const VALID_ROLES = ["admin", "user"] as const;

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
  const role = body.role as string;

  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // 自我保护：不允许修改自己的角色（防止唯一 admin 把自己降级后锁出后台）
  if (id === adminId) {
    return NextResponse.json(
      { error: "cannot_modify_self", message: "不能修改自己的角色（请让另一个管理员操作）" },
      { status: 400 }
    );
  }

  const target = findAccountById(id);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (target.role === role) {
    return NextResponse.json({ ok: true, role, unchanged: true });
  }

  getDb().prepare("UPDATE user_profiles SET role = ? WHERE id = ?").run(role, id);

  logEvent({
    ownerId: adminId,
    category: "account",
    level: role === "admin" ? "warn" : "info",
    message:
      role === "admin"
        ? `任命管理员：用户 ${target.displayName}（${target.phone ?? "无手机号"}）`
        : `取消管理员：用户 ${target.displayName}（${target.phone ?? "无手机号"}）`,
    metadata: { targetUserId: id, previousRole: target.role, newRole: role },
  });

  return NextResponse.json({ ok: true, role });
}
