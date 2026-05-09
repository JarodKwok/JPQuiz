"use client";

import { db } from "./db";

const MIGRATION_FLAG = "jpquiz-data-migrated-to-server";

/** Check if data migration from IndexedDB to server has been completed */
export function isMigrationComplete(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MIGRATION_FLAG) === "true";
}

/** Export all user-isolated data from IndexedDB and POST to server */
export async function migrateIndexedDBToServer(): Promise<{
  success: boolean;
  totalInserted: number;
  error?: string;
}> {
  if (isMigrationComplete()) {
    return { success: true, totalInserted: 0 };
  }

  try {
    // Read all tables from IndexedDB
    const [
      userProfiles,
      learningProgress,
      masteryStatus,
      wrongAnswers,
      studySessions,
      quizSessions,
      aiConversations,
      aiMessages,
      aiConversationSummaries,
      aiLongTermMemories,
      systemLogs,
    ] = await Promise.all([
      db.userProfiles.toArray(),
      db.learningProgress.toArray(),
      db.masteryStatus.toArray(),
      db.wrongAnswers.toArray(),
      db.studySessions.toArray(),
      db.quizSessions.toArray(),
      db.aiConversations.toArray(),
      db.aiMessages.toArray(),
      db.aiConversationSummaries.toArray(),
      db.aiLongTermMemories.toArray(),
      db.systemLogs.toArray(),
    ]);

    const totalRecords =
      userProfiles.length +
      learningProgress.length +
      masteryStatus.length +
      wrongAnswers.length +
      studySessions.length +
      quizSessions.length +
      aiConversations.length +
      aiMessages.length +
      aiConversationSummaries.length +
      aiLongTermMemories.length +
      systemLogs.length;

    if (totalRecords === 0) {
      // No data to migrate
      localStorage.setItem(MIGRATION_FLAG, "true");
      return { success: true, totalInserted: 0 };
    }

    const res = await fetch("/api/db/migrate/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tables: {
          userProfiles,
          learningProgress,
          masteryStatus,
          wrongAnswers,
          studySessions,
          quizSessions,
          aiConversations,
          aiMessages,
          aiConversationSummaries,
          aiLongTermMemories,
          systemLogs,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, totalInserted: 0, error: err };
    }

    const data = await res.json();
    localStorage.setItem(MIGRATION_FLAG, "true");

    return { success: true, totalInserted: data.totalInserted };
  } catch (err) {
    return {
      success: false,
      totalInserted: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
