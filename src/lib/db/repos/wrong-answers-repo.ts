import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

interface WrongAnswerRow {
  id: number;
  owner_id: string;
  lesson_id: number;
  module: string;
  question: string;
  user_answer: string | null;
  correct_answer: string;
  error_reason: string | null;
  status: string;
  question_type: string | null;
  source_type: string | null;
  knowledge_keys: string | null;
  created_at: string;
}

function rowToWrongAnswer(row: WrongAnswerRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    lessonId: row.lesson_id,
    module: row.module,
    question: row.question,
    userAnswer: row.user_answer || undefined,
    correctAnswer: row.correct_answer,
    errorReason: row.error_reason || undefined,
    status: row.status,
    questionType: row.question_type || undefined,
    sourceType: row.source_type || undefined,
    knowledgeKeys: row.knowledge_keys ? JSON.parse(row.knowledge_keys) : undefined,
    createdAt: row.created_at,
  };
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "wrong-answers/save": (_req, ownerId, body) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO wrong_answers (owner_id, lesson_id, module, question, user_answer, correct_answer, error_reason, status, question_type, source_type, knowledge_keys, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ownerId,
      body.lessonId,
      body.module,
      body.question,
      body.userAnswer || null,
      body.correctAnswer,
      body.errorReason || null,
      body.status || "weak",
      body.questionType || null,
      body.sourceType || null,
      body.knowledgeKeys ? JSON.stringify(body.knowledgeKeys) : null,
      body.createdAt || new Date().toISOString()
    );
    return { id: result.lastInsertRowid };
  },

  "wrong-answers/list": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM wrong_answers WHERE owner_id = ? ORDER BY created_at DESC"
    ).all(ownerId) as WrongAnswerRow[];
    return rows.map(rowToWrongAnswer);
  },

  "wrong-answers/list-by-scope": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const module = url.searchParams.get("module");
    const rows = db.prepare(
      "SELECT * FROM wrong_answers WHERE owner_id = ? AND lesson_id = ? AND module = ? ORDER BY created_at DESC"
    ).all(ownerId, lessonId, module) as WrongAnswerRow[];
    return rows.map(rowToWrongAnswer);
  },

  "wrong-answers/count": (_req, ownerId) => {
    const db = getDb();
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM wrong_answers WHERE owner_id = ?"
    ).get(ownerId) as { cnt: number };
    return { count: row.cnt };
  },
};
