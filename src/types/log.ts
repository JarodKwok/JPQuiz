export type LogCategory = "account" | "quiz" | "settings" | "system";
export type LogLevel = "info" | "warn" | "error";

export interface SystemLog {
  id?: number;
  ownerId: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
