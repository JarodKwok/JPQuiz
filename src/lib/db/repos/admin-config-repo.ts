import { getDb } from "../sqlite";

// ── Admin 全平台模型配置（singleton 行）──────────────────────────────────

export interface AdminModelConfig {
  provider: string;           // openrouter / openai / kimi / deepseek / custom
  baseUrl: string;
  apiKey: string;             // 完整 Key（仅 server 内部使用）
  model: string;
  wireApi: "chat" | "responses";
  reasoningEffort: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

interface ConfigRow {
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  wire_api: string;
  reasoning_effort: string | null;
  updated_at: number;
  updated_by: string | null;
}

function rowToConfig(row: ConfigRow): AdminModelConfig {
  return {
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    wireApi: (row.wire_api as "chat" | "responses") ?? "chat",
    reasoningEffort: row.reasoning_effort,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function getAdminModelConfig(): AdminModelConfig | null {
  const row = getDb()
    .prepare("SELECT * FROM admin_model_config WHERE id = 1")
    .get() as ConfigRow | undefined;
  return row ? rowToConfig(row) : null;
}

export interface AdminModelConfigUpdate {
  provider: string;
  baseUrl: string;
  apiKey?: string;            // 不传则保留旧值
  model: string;
  wireApi: "chat" | "responses";
  reasoningEffort?: string | null;
  updatedBy: string;
}

export function upsertAdminModelConfig(input: AdminModelConfigUpdate): AdminModelConfig {
  const db = getDb();
  const now = Date.now();
  const existing = getAdminModelConfig();
  const apiKey = input.apiKey?.trim() ? input.apiKey.trim() : existing?.apiKey;

  if (!apiKey) {
    throw new Error("apiKey required for first-time configuration");
  }

  db.prepare(
    `INSERT INTO admin_model_config
       (id, provider, base_url, api_key, model, wire_api, reasoning_effort, updated_at, updated_by)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       base_url = excluded.base_url,
       api_key = excluded.api_key,
       model = excluded.model,
       wire_api = excluded.wire_api,
       reasoning_effort = excluded.reasoning_effort,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).run(
    input.provider,
    input.baseUrl,
    apiKey,
    input.model,
    input.wireApi,
    input.reasoningEffort ?? null,
    now,
    input.updatedBy
  );

  return getAdminModelConfig()!;
}

/** 给前端展示用的脱敏版本 — API Key 只露头尾几位 */
export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

// ── 月度 AI 调用次数 ─────────────────────────────────────────────────────

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyUsage(userId: string, yearMonth: string): number {
  const row = getDb()
    .prepare("SELECT count FROM ai_usage_monthly WHERE user_id = ? AND year_month = ?")
    .get(userId, yearMonth) as { count: number } | undefined;
  return row?.count ?? 0;
}

/** 原子地 +1 并返回新值。同月首次调用会 INSERT。 */
export function incrementMonthlyUsage(userId: string, yearMonth: string): number {
  const db = getDb();
  db.prepare(
    `INSERT INTO ai_usage_monthly (user_id, year_month, count)
     VALUES (?, ?, 1)
     ON CONFLICT(user_id, year_month) DO UPDATE SET count = count + 1`
  ).run(userId, yearMonth);
  return getMonthlyUsage(userId, yearMonth);
}
