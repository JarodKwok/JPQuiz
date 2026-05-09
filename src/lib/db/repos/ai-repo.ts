import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

interface ConversationRow {
  id: number;
  owner_id: string;
  title: string;
  lesson_id: number;
  module: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  owner_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface SummaryRow {
  id: number;
  conversation_id: number;
  owner_id: string;
  summary: string;
  message_count: number;
  updated_at: string;
}

interface MemoryRow {
  id: number;
  owner_id: string;
  kind: string;
  text: string;
  score: number;
  source: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

function rowToConversation(row: ConversationRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    lessonId: row.lesson_id,
    module: row.module,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  };
}

function rowToMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    ownerId: row.owner_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function rowToSummary(row: SummaryRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    ownerId: row.owner_id,
    summary: row.summary,
    messageCount: row.message_count,
    updatedAt: row.updated_at,
  };
}

function rowToMemory(row: MemoryRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    text: row.text,
    score: row.score,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at || undefined,
  };
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "ai/conversation/get": (req) => {
    const db = getDb();
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    const row = db.prepare("SELECT * FROM ai_conversations WHERE id = ?").get(id) as ConversationRow | undefined;
    return row ? rowToConversation(row) : null;
  },

  "ai/conversation/create": (_req, ownerId, body) => {
    const db = getDb();
    const now = (body.createdAt as string) || new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO ai_conversations (owner_id, title, lesson_id, module, created_at, updated_at, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ownerId, body.title, body.lessonId, body.module, now, now, now);
    const row = db.prepare("SELECT * FROM ai_conversations WHERE id = ?").get(result.lastInsertRowid) as ConversationRow;
    return rowToConversation(row);
  },

  "ai/conversation/update": (_req, _ownerId, body) => {
    const db = getDb();
    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.title !== undefined) { sets.push("title = ?"); params.push(body.title); }
    if (body.updatedAt !== undefined) { sets.push("updated_at = ?"); params.push(body.updatedAt); }
    if (body.lastMessageAt !== undefined) { sets.push("last_message_at = ?"); params.push(body.lastMessageAt); }

    if (sets.length === 0) return { ok: true };
    params.push(body.conversationId);
    db.prepare(`UPDATE ai_conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return { ok: true };
  },

  "ai/messages/list": (req) => {
    const db = getDb();
    const url = new URL(req.url);
    const conversationId = Number(url.searchParams.get("conversationId"));
    const rows = db.prepare(
      "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).all(conversationId) as MessageRow[];
    return rows.map(rowToMessage);
  },

  "ai/messages/append": (_req, ownerId, body) => {
    const db = getDb();
    const now = (body.createdAt as string) || new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO ai_messages (conversation_id, owner_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(body.conversationId, ownerId, body.role, body.content, now);
    const row = db.prepare("SELECT * FROM ai_messages WHERE id = ?").get(result.lastInsertRowid) as MessageRow;
    return rowToMessage(row);
  },

  "ai/summary/get": (req) => {
    const db = getDb();
    const url = new URL(req.url);
    const conversationId = Number(url.searchParams.get("conversationId"));
    const row = db.prepare(
      "SELECT * FROM ai_conversation_summaries WHERE conversation_id = ? ORDER BY updated_at DESC LIMIT 1"
    ).get(conversationId) as SummaryRow | undefined;
    return row ? rowToSummary(row) : null;
  },

  "ai/summary/upsert": (_req, ownerId, body) => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare(
      "SELECT * FROM ai_conversation_summaries WHERE conversation_id = ?"
    ).get(body.conversationId) as SummaryRow | undefined;

    if (existing) {
      db.prepare(
        "UPDATE ai_conversation_summaries SET summary = ?, message_count = ?, updated_at = ? WHERE id = ?"
      ).run(body.summary, body.messageCount, now, existing.id);
      return { ...rowToSummary(existing), summary: body.summary, messageCount: body.messageCount, updatedAt: now };
    }

    const result = db.prepare(`
      INSERT INTO ai_conversation_summaries (conversation_id, owner_id, summary, message_count, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(body.conversationId, ownerId, body.summary, body.messageCount, now);
    const row = db.prepare("SELECT * FROM ai_conversation_summaries WHERE id = ?").get(result.lastInsertRowid) as SummaryRow;
    return rowToSummary(row);
  },

  "ai/memories/list": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM ai_long_term_memories WHERE owner_id = ? ORDER BY score DESC, updated_at DESC"
    ).all(ownerId) as MemoryRow[];
    return rows.map(rowToMemory);
  },
};
