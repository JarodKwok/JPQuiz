import { getDb } from "../sqlite";
import type { NextRequest } from "next/server";

export const handlers: Record<string, (req: NextRequest, ownerId: string, body: Record<string, unknown>) => unknown> = {
  "migrate/import": (_req, _ownerId, body) => {
    const db = getDb();
    const tables = body.tables as Record<string, unknown[]>;
    let totalInserted = 0;

    const importAll = db.transaction(() => {
      // user_profiles
      if (tables.userProfiles?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO user_profiles (id, display_name, avatar_emoji, role, created_at, last_active_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.userProfiles as Array<Record<string, unknown>>) {
          stmt.run(r.id, r.displayName, r.avatarEmoji || "🌸", r.role || "user", r.createdAt, r.lastActiveAt);
          totalInserted++;
        }
      }

      // learning_progress
      if (tables.learningProgress?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO learning_progress (owner_id, lesson_id, module, mastery_percent, total_items, last_studied_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.learningProgress as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.lessonId, r.module, r.masteryPercent, r.totalItems ?? null, r.lastStudiedAt ?? null, r.updatedAt);
          totalInserted++;
        }
      }

      // mastery_status
      if (tables.masteryStatus?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO mastery_status (owner_id, lesson_id, module, item_key, status, review_count, last_reviewed_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.masteryStatus as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.lessonId, r.module, r.itemKey, r.status, r.reviewCount || 0, r.lastReviewedAt ?? null, r.createdAt);
          totalInserted++;
        }
      }

      // wrong_answers
      if (tables.wrongAnswers?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO wrong_answers (owner_id, lesson_id, module, question, user_answer, correct_answer, error_reason, status, question_type, source_type, knowledge_keys, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.wrongAnswers as Array<Record<string, unknown>>) {
          stmt.run(
            r.ownerId, r.lessonId, r.module, r.question, r.userAnswer ?? null, r.correctAnswer,
            r.errorReason ?? null, r.status || "weak", r.questionType ?? null, r.sourceType ?? null,
            r.knowledgeKeys ? JSON.stringify(r.knowledgeKeys) : null, r.createdAt
          );
          totalInserted++;
        }
      }

      // study_sessions
      if (tables.studySessions?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO study_sessions (owner_id, date, duration_seconds, module, lesson_id)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const r of tables.studySessions as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.date, r.durationSeconds, r.module ?? null, r.lessonId ?? null);
          totalInserted++;
        }
      }

      // quiz_sessions
      if (tables.quizSessions?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO quiz_sessions (owner_id, title, lesson_id, module, source_type, question_type, total_questions, correct_count, accuracy, target_labels, results, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.quizSessions as Array<Record<string, unknown>>) {
          stmt.run(
            r.ownerId, r.title, r.lessonId, r.module, r.sourceType, r.questionType,
            r.totalQuestions, r.correctCount, r.accuracy,
            r.targetLabels ? JSON.stringify(r.targetLabels) : null,
            JSON.stringify(r.results), r.createdAt
          );
          totalInserted++;
        }
      }

      // ai_conversations
      if (tables.aiConversations?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO ai_conversations (owner_id, title, lesson_id, module, created_at, updated_at, last_message_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.aiConversations as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.title, r.lessonId, r.module, r.createdAt, r.updatedAt, r.lastMessageAt);
          totalInserted++;
        }
      }

      // ai_messages
      if (tables.aiMessages?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO ai_messages (conversation_id, owner_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const r of tables.aiMessages as Array<Record<string, unknown>>) {
          stmt.run(r.conversationId, r.ownerId, r.role, r.content, r.createdAt);
          totalInserted++;
        }
      }

      // ai_conversation_summaries
      if (tables.aiConversationSummaries?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO ai_conversation_summaries (conversation_id, owner_id, summary, message_count, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const r of tables.aiConversationSummaries as Array<Record<string, unknown>>) {
          stmt.run(r.conversationId, r.ownerId, r.summary, r.messageCount, r.updatedAt);
          totalInserted++;
        }
      }

      // ai_long_term_memories
      if (tables.aiLongTermMemories?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO ai_long_term_memories (owner_id, kind, text, score, source, created_at, updated_at, last_used_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.aiLongTermMemories as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.kind, r.text, r.score, r.source, r.createdAt, r.updatedAt, r.lastUsedAt ?? null);
          totalInserted++;
        }
      }

      // system_logs
      if (tables.systemLogs?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO system_logs (owner_id, category, level, message, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.systemLogs as Array<Record<string, unknown>>) {
          stmt.run(r.ownerId, r.category, r.level, r.message, r.metadata ? JSON.stringify(r.metadata) : null, r.createdAt);
          totalInserted++;
        }
      }
    });

    importAll();
    return { totalInserted };
  },
};
