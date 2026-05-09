import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/sqlite";
import { logEvent } from "@/lib/db/repos/log-repo";

/**
 * 会员到期自动降级
 *
 * 触发方式（阿里云上 crontab）：
 *   0 3 * * * curl -fsS -X POST -H "X-Cron-Secret: ${CRON_SECRET}" \
 *     http://localhost:3006/api/cron/check-expiry > /dev/null 2>&1
 *
 * 不依赖登录态。env CRON_SECRET 必须配置，否则端点直接返回 503。
 */
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const got = req.headers.get("x-cron-secret");
  if (got !== expectedSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getDb();
  const now = Date.now();
  const expired = db
    .prepare(
      "SELECT id, display_name, phone FROM user_profiles WHERE tier = 'premium' AND tier_expires_at < ?"
    )
    .all(now) as Array<{ id: string; display_name: string; phone: string | null }>;

  if (expired.length === 0) {
    return NextResponse.json({ ok: true, demoted: 0, ids: [] });
  }

  const tx = db.transaction(() => {
    const stmt = db.prepare(
      "UPDATE user_profiles SET tier = 'free', tier_expires_at = NULL WHERE id = ?"
    );
    for (const u of expired) {
      stmt.run(u.id);
      logEvent({
        ownerId: u.id,
        category: "account",
        level: "info",
        message: `会员到期自动降级：${u.display_name}（${u.phone ?? "无手机号"}）`,
        metadata: { autoDemotion: true, checkedAt: now },
      });
    }
  });
  tx();

  return NextResponse.json({
    ok: true,
    demoted: expired.length,
    ids: expired.map((u) => u.id),
  });
}
