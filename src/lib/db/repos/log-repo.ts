import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

/**
 * 服务端直接写日志的 helper（不走 HTTP）。
 * 给 admin route handlers 等服务端代码用。
 */
export function logEvent(input: {
  ownerId: string;
  category: "account" | "quiz" | "settings" | "system";
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO system_logs (owner_id, category, level, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.ownerId,
    input.category,
    input.level,
    input.message,
    input.metadata ? JSON.stringify(input.metadata) : null,
    new Date().toISOString()
  );
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "log/insert": (_req, ownerId, body) => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO system_logs (owner_id, category, level, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      ownerId,
      body.category,
      body.level,
      body.message,
      body.metadata ? JSON.stringify(body.metadata) : null,
      body.createdAt || new Date().toISOString()
    );
    return { id: result.lastInsertRowid };
  },

  "log/list": (req) => {
    const db = getDb();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 50;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const category = url.searchParams.get("category");
    const level = url.searchParams.get("level");

    let whereClauses = "WHERE 1=1";
    const params: unknown[] = [];

    if (category) {
      whereClauses += " AND category = ?";
      params.push(category);
    }
    if (level) {
      whereClauses += " AND level = ?";
      params.push(level);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM system_logs ${whereClauses}`).get(...params) as { cnt: number };

    const rows = db.prepare(`SELECT * FROM system_logs ${whereClauses} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Record<string, unknown>[];

    return {
      logs: rows.map(rowToLog),
      total: countRow.cnt,
    };
  },

  "log/clear-old": (_req, _ownerId, body) => {
    const db = getDb();
    const days = (body.days as number) || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const result = db.prepare("DELETE FROM system_logs WHERE created_at < ?").run(cutoff);
    return { deleted: result.changes };
  },
};

function rowToLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    category: row.category,
    level: row.level,
    message: row.message,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    createdAt: row.created_at,
  };
}
