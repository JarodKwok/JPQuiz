"use client";

import type { LogCategory, LogLevel, SystemLog } from "@/types/log";

/** 写入一条系统日志 */
export async function logEvent(
  category: LogCategory,
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/db/log/insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        level,
        message,
        metadata,
        createdAt: new Date().toISOString(),
      }),
    });
  } catch {
    // Logging should never break the app
  }
}

/** 查询系统日志（分页） */
export async function getSystemLogs(options: {
  category?: LogCategory;
  level?: LogLevel;
  limit?: number;
  offset?: number;
}): Promise<{ logs: SystemLog[]; total: number }> {
  const { category, level, limit = 50, offset = 0 } = options;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (category) params.set("category", category);
  if (level) params.set("level", level);

  const res = await fetch(`/api/db/log/list?${params}`);
  if (!res.ok) return { logs: [], total: 0 };
  return res.json();
}

/** 清理指定天数之前的旧日志 */
export async function clearOldLogs(olderThanDays: number): Promise<number> {
  const res = await fetch("/api/db/log/clear-old", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days: olderThanDays }),
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.deleted;
}
