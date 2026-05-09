import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "quiz/save-session": (_req, ownerId, body) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO quiz_sessions (owner_id, title, lesson_id, module, source_type, question_type, total_questions, correct_count, accuracy, target_labels, results, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ownerId,
      body.title,
      body.lessonId,
      body.module,
      body.sourceType,
      body.questionType,
      body.totalQuestions,
      body.correctCount,
      body.accuracy,
      body.targetLabels ? JSON.stringify(body.targetLabels) : null,
      JSON.stringify(body.results),
      body.createdAt || new Date().toISOString()
    );
    return { id: result.lastInsertRowid };
  },

  "quiz/list-by-scope": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const module = url.searchParams.get("module");
    const rows = db.prepare(
      "SELECT * FROM quiz_sessions WHERE owner_id = ? AND lesson_id = ? AND module = ? ORDER BY created_at DESC"
    ).all(ownerId, lessonId, module) as Record<string, unknown>[];
    return rows.map(rowToQuizSession);
  },

  "quiz/list-by-owner": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM quiz_sessions WHERE owner_id = ? ORDER BY created_at DESC"
    ).all(ownerId) as Record<string, unknown>[];
    return rows.map(rowToQuizSession);
  },

  "quiz/weak-targets-data": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const module = url.searchParams.get("module");

    const masteryRows = db.prepare(
      "SELECT item_key, status, review_count FROM mastery_status WHERE owner_id = ? AND lesson_id = ? AND module = ?"
    ).all(ownerId, lessonId, module) as { item_key: string; status: string; review_count: number }[];

    const wrongRows = db.prepare(
      "SELECT knowledge_keys FROM wrong_answers WHERE owner_id = ? AND lesson_id = ? AND module = ?"
    ).all(ownerId, lessonId, module) as { knowledge_keys: string | null }[];

    return {
      masteryStatuses: masteryRows.map(r => ({
        itemKey: r.item_key,
        status: r.status,
        reviewCount: r.review_count,
      })),
      wrongAnswers: wrongRows.map(r => ({
        knowledgeKeys: r.knowledge_keys ? JSON.parse(r.knowledge_keys) : [],
      })),
    };
  },
};

function rowToQuizSession(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    lessonId: row.lesson_id,
    module: row.module,
    sourceType: row.source_type,
    questionType: row.question_type,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    accuracy: row.accuracy,
    targetLabels: row.target_labels ? JSON.parse(row.target_labels as string) : undefined,
    results: JSON.parse(row.results as string),
    createdAt: row.created_at,
  };
}
