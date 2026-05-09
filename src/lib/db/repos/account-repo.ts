import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_emoji: string;
  role: string;
  created_at: string;
  last_active_at: string;
}

function rowToProfile(row: ProfileRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    role: row.role as "admin" | "user",
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

/** All tables with owner_id column, for cascading operations */
const OWNED_TABLES = [
  "learning_progress",
  "mastery_status",
  "wrong_answers",
  "study_sessions",
  "quiz_sessions",
  "ai_conversations",
  "ai_messages",
  "ai_conversation_summaries",
  "ai_long_term_memories",
  "system_logs",
] as const;

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "account/list": () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM user_profiles ORDER BY last_active_at DESC").all() as ProfileRow[];
    return rows.map(rowToProfile);
  },

  "account/get": (req) => {
    const db = getDb();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return null;
    const row = db.prepare("SELECT * FROM user_profiles WHERE id = ?").get(userId) as ProfileRow | undefined;
    return row ? rowToProfile(row) : null;
  },

  "account/create": (_req, _ownerId, body) => {
    const db = getDb();
    const id = body.id as string;
    const now = (body.createdAt as string) || new Date().toISOString();
    db.prepare(`
      INSERT INTO user_profiles (id, display_name, avatar_emoji, role, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.displayName, body.avatarEmoji || "🌸", body.role || "user", now, now);
    const row = db.prepare("SELECT * FROM user_profiles WHERE id = ?").get(id) as ProfileRow;
    return rowToProfile(row);
  },

  "account/update": (_req, _ownerId, body) => {
    const db = getDb();
    const userId = body.userId as string;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.displayName !== undefined) {
      sets.push("display_name = ?");
      params.push(body.displayName);
    }
    if (body.avatarEmoji !== undefined) {
      sets.push("avatar_emoji = ?");
      params.push(body.avatarEmoji);
    }
    if (body.lastActiveAt !== undefined) {
      sets.push("last_active_at = ?");
      params.push(body.lastActiveAt);
    }

    if (sets.length === 0) return { ok: true };
    params.push(userId);
    db.prepare(`UPDATE user_profiles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return { ok: true };
  },

  "account/delete": (_req, _ownerId, body) => {
    const db = getDb();
    const userId = body.userId as string;

    const deleteAll = db.transaction(() => {
      for (const table of OWNED_TABLES) {
        db.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).run(userId);
      }
      db.prepare("DELETE FROM user_profiles WHERE id = ?").run(userId);
    });
    deleteAll();
    return { ok: true };
  },

  "account/transfer": (_req, _ownerId, body) => {
    const db = getDb();
    const fromUserId = body.fromUserId as string;
    const toUserId = body.toUserId as string;
    let total = 0;

    const transfer = db.transaction(() => {
      for (const table of OWNED_TABLES) {
        const result = db.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`).run(toUserId, fromUserId);
        total += result.changes;
      }
    });
    transfer();
    return { total };
  },

  "account/migrate-default": (_req, _ownerId, body) => {
    const db = getDb();
    const newUserId = body.newUserId as string;
    const fromId = "local-default";

    const migrate = db.transaction(() => {
      for (const table of OWNED_TABLES) {
        db.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`).run(newUserId, fromId);
      }
      db.prepare("DELETE FROM user_profiles WHERE id = ?").run(fromId);
    });
    migrate();
    return { ok: true };
  },

  "account/needs-setup": () => {
    const db = getDb();
    const rows = db.prepare("SELECT id FROM user_profiles").all() as { id: string }[];
    return {
      needsSetup: rows.length === 0 || (rows.length === 1 && rows[0].id === "local-default"),
    };
  },
};
