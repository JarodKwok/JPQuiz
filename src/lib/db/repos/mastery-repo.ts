import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

interface MasteryRow {
  id: number;
  owner_id: string;
  lesson_id: number;
  module: string;
  item_key: string;
  status: string;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
}

function rowToMastery(row: MasteryRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    lessonId: row.lesson_id,
    module: row.module,
    itemKey: row.item_key,
    status: row.status,
    reviewCount: row.review_count,
    lastReviewedAt: row.last_reviewed_at || undefined,
    createdAt: row.created_at,
  };
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "mastery/save": (_req, ownerId, body) => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare(
      "SELECT * FROM mastery_status WHERE owner_id = ? AND lesson_id = ? AND module = ? AND item_key = ?"
    ).get(ownerId, body.lessonId, body.module, body.itemKey) as MasteryRow | undefined;

    if (existing) {
      db.prepare(
        "UPDATE mastery_status SET status = ?, review_count = ?, last_reviewed_at = ? WHERE id = ?"
      ).run(body.status, existing.review_count + 1, now, existing.id);
      return { id: existing.id };
    } else {
      const result = db.prepare(`
        INSERT INTO mastery_status (owner_id, lesson_id, module, item_key, status, review_count, last_reviewed_at, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(ownerId, body.lessonId, body.module, body.itemKey, body.status, now, now);
      return { id: result.lastInsertRowid };
    }
  },

  "mastery/map": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const module = url.searchParams.get("module");

    const rows = db.prepare(
      "SELECT item_key, status FROM mastery_status WHERE owner_id = ? AND lesson_id = ? AND module = ?"
    ).all(ownerId, lessonId, module) as { item_key: string; status: string }[];

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.item_key] = row.status;
    }
    return map;
  },

  "mastery/weak-items": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = url.searchParams.get("lessonId");

    let sql = "SELECT * FROM mastery_status WHERE owner_id = ? AND status IN ('weak', 'fuzzy')";
    const params: unknown[] = [ownerId];

    if (lessonId) {
      sql += " AND lesson_id = ?";
      params.push(Number(lessonId));
    }

    const rows = db.prepare(sql).all(...params) as MasteryRow[];
    return rows.map(rowToMastery);
  },

  "mastery/update-by-id": (_req, _ownerId, body) => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT review_count FROM mastery_status WHERE id = ?").get(body.id) as { review_count: number } | undefined;
    if (!existing) return { ok: false };

    db.prepare(
      "UPDATE mastery_status SET status = ?, review_count = ?, last_reviewed_at = ? WHERE id = ?"
    ).run(body.status, existing.review_count + 1, now, body.id);
    return { ok: true };
  },

  "mastery/delete-by-id": (_req, _ownerId, body) => {
    const db = getDb();
    db.prepare("DELETE FROM mastery_status WHERE id = ?").run(body.id);
    return { ok: true };
  },

  "mastery/list-by-owner": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM mastery_status WHERE owner_id = ?").all(ownerId) as MasteryRow[];
    return rows.map(rowToMastery);
  },

  "mastery/list-by-scope": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const module = url.searchParams.get("module");
    const rows = db.prepare(
      "SELECT * FROM mastery_status WHERE owner_id = ? AND lesson_id = ? AND module = ?"
    ).all(ownerId, lessonId, module) as MasteryRow[];
    return rows.map(rowToMastery);
  },
};
