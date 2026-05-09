import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

interface ProgressRow {
  id: number;
  owner_id: string;
  lesson_id: number;
  module: string;
  mastery_percent: number;
  total_items: number | null;
  last_studied_at: string | null;
  updated_at: string;
}

interface SessionRow {
  id: number;
  owner_id: string;
  date: string;
  duration_seconds: number;
  module: string | null;
  lesson_id: number | null;
}

function rowToProgress(row: ProgressRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    lessonId: row.lesson_id,
    module: row.module,
    masteryPercent: row.mastery_percent,
    totalItems: row.total_items ?? undefined,
    lastStudiedAt: row.last_studied_at || undefined,
    updatedAt: row.updated_at,
  };
}

function rowToSession(row: SessionRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    date: row.date,
    durationSeconds: row.duration_seconds,
    module: row.module || undefined,
    lessonId: row.lesson_id ?? undefined,
  };
}

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "progress/sync": (_req, ownerId, body) => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare(
      "SELECT id FROM learning_progress WHERE owner_id = ? AND lesson_id = ? AND module = ?"
    ).get(ownerId, body.lessonId, body.module) as { id: number } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE learning_progress SET mastery_percent = ?, total_items = ?, last_studied_at = ?, updated_at = ?
        WHERE id = ?
      `).run(body.masteryPercent, body.totalItems ?? null, now, now, existing.id);
      return { id: existing.id };
    } else {
      const result = db.prepare(`
        INSERT INTO learning_progress (owner_id, lesson_id, module, mastery_percent, total_items, last_studied_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ownerId, body.lessonId, body.module, body.masteryPercent, body.totalItems ?? null, now, now);
      return { id: result.lastInsertRowid };
    }
  },

  "progress/lesson-summary": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const lessonId = Number(url.searchParams.get("lessonId"));
    const rows = db.prepare(
      "SELECT module, mastery_percent FROM learning_progress WHERE owner_id = ? AND lesson_id = ?"
    ).all(ownerId, lessonId) as { module: string; mastery_percent: number }[];

    const summary: Record<string, number> = { vocabulary: 0, grammar: 0, text: 0, examples: 0 };
    for (const row of rows) {
      summary[row.module] = row.mastery_percent;
    }
    return summary;
  },

  "progress/record-session": (_req, ownerId, body) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO study_sessions (owner_id, date, duration_seconds, module, lesson_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(ownerId, body.date, body.durationSeconds, body.module || null, body.lessonId ?? null);
    return { id: result.lastInsertRowid };
  },

  "progress/clear-sessions": (_req, ownerId) => {
    const db = getDb();
    const result = db.prepare("DELETE FROM study_sessions WHERE owner_id = ?").run(ownerId);
    return { deleted: result.changes };
  },

  "progress/today-minutes": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const today = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const row = db.prepare(
      "SELECT COALESCE(SUM(duration_seconds), 0) as total FROM study_sessions WHERE owner_id = ? AND date = ?"
    ).get(ownerId, today) as { total: number };
    return { minutes: Math.round(row.total / 60) };
  },

  "progress/history-stats": (req, ownerId) => {
    const db = getDb();
    const url = new URL(req.url);
    const filterLessonId = url.searchParams.get("lessonId");
    const lessonFilter = filterLessonId ? Number(filterLessonId) : null;

    // Fetch all data for this user
    let progressSql = "SELECT * FROM learning_progress WHERE owner_id = ?";
    let masterySql = "SELECT * FROM mastery_status WHERE owner_id = ?";
    let sessionsSql = "SELECT * FROM study_sessions WHERE owner_id = ?";
    let wrongSql = "SELECT COUNT(*) as cnt FROM wrong_answers WHERE owner_id = ?";
    let quizSql = "SELECT * FROM quiz_sessions WHERE owner_id = ?";

    const params: unknown[] = [ownerId];

    if (lessonFilter !== null) {
      progressSql += " AND lesson_id = ?";
      masterySql += " AND lesson_id = ?";
      sessionsSql += " AND lesson_id = ?";
      wrongSql += " AND lesson_id = ?";
      quizSql += " AND lesson_id = ?";
    }

    const progressRows = db.prepare(progressSql).all(...params, ...(lessonFilter !== null ? [lessonFilter] : [])) as ProgressRow[];
    const masteryRows = db.prepare(masterySql).all(...params, ...(lessonFilter !== null ? [lessonFilter] : [])) as Array<{
      id: number; owner_id: string; lesson_id: number; module: string; item_key: string;
      status: string; review_count: number; last_reviewed_at: string | null; created_at: string;
    }>;
    const sessionRows = db.prepare(sessionsSql).all(...params, ...(lessonFilter !== null ? [lessonFilter] : [])) as SessionRow[];
    const wrongRow = db.prepare(wrongSql).get(...params, ...(lessonFilter !== null ? [lessonFilter] : [])) as { cnt: number };
    const quizRows = db.prepare(quizSql).all(...params, ...(lessonFilter !== null ? [lessonFilter] : [])) as Array<{
      id: number; title: string; lesson_id: number; module: string;
      question_type: string; source_type: string; total_questions: number;
      correct_count: number; accuracy: number; created_at: string;
    }>;

    // Studied lessons
    const studiedLessonSet = new Set<number>();
    for (const p of progressRows) studiedLessonSet.add(p.lesson_id);
    for (const s of sessionRows) if (s.lesson_id != null) studiedLessonSet.add(s.lesson_id);
    for (const q of quizRows) studiedLessonSet.add(q.lesson_id);

    // Module mastery counts + progress
    const moduleMasteryCounts: Record<string, number> = { vocabulary: 0, grammar: 0, text: 0, examples: 0 };
    const moduleProgressTotals: Record<string, { total: number; count: number }> = {
      vocabulary: { total: 0, count: 0 }, grammar: { total: 0, count: 0 },
      text: { total: 0, count: 0 }, examples: { total: 0, count: 0 },
    };

    for (const m of masteryRows) {
      if (m.status === "mastered" && moduleMasteryCounts[m.module] !== undefined) {
        moduleMasteryCounts[m.module] += 1;
      }
    }
    for (const p of progressRows) {
      const bucket = moduleProgressTotals[p.module];
      if (bucket) { bucket.total += p.mastery_percent; bucket.count += 1; }
    }

    const moduleProgress: Record<string, number> = {};
    for (const mod of ["vocabulary", "grammar", "text", "examples"]) {
      const b = moduleProgressTotals[mod];
      moduleProgress[mod] = b.count > 0 ? Math.round(b.total / b.count) : 0;
    }

    const totalStudySeconds = sessionRows.reduce((s, r) => s + r.duration_seconds, 0);

    // Quiz accuracy by type
    const quizAccTotals: Record<string, { correct: number; total: number }> = {
      multiple_choice: { correct: 0, total: 0 },
      fill_blank: { correct: 0, total: 0 },
      translation: { correct: 0, total: 0 },
    };
    for (const q of quizRows) {
      const b = quizAccTotals[q.question_type];
      if (b) { b.correct += q.correct_count; b.total += q.total_questions; }
    }
    const quizAccuracyByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(quizAccTotals)) {
      quizAccuracyByType[k] = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
    }

    const weakItems = masteryRows
      .filter(m => m.status === "weak" || m.status === "fuzzy")
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 5)
      .map(m => ({ itemKey: m.item_key, lessonId: m.lesson_id, module: m.module, status: m.status, reviewCount: m.review_count }));

    const masteredItems = masteryRows.filter(m => m.status === "mastered").length;

    const recentQuizSessions = [...quizRows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(q => ({
        title: q.title, lessonId: q.lesson_id, module: q.module,
        questionType: q.question_type, sourceType: q.source_type,
        accuracy: q.accuracy, createdAt: q.created_at,
      }));

    return {
      lessonsStudied: studiedLessonSet.size,
      masteredItems,
      totalStudyMinutes: Math.round(totalStudySeconds / 60),
      wrongAnswersCount: wrongRow.cnt,
      totalQuizSessions: quizRows.length,
      moduleMasteryCounts,
      moduleProgress,
      quizAccuracyByType,
      recentQuizSessions,
      weakItems,
    };
  },

  "progress/list-by-owner": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM learning_progress WHERE owner_id = ?").all(ownerId) as ProgressRow[];
    return rows.map(rowToProgress);
  },

  "progress/sessions-by-owner": (_req, ownerId) => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM study_sessions WHERE owner_id = ?").all(ownerId) as SessionRow[];
    return rows.map(rowToSession);
  },
};
