-- JPQuiz Server-Side Schema
-- SQLite with WAL mode

CREATE TABLE IF NOT EXISTS user_profiles (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  avatar_emoji  TEXT NOT NULL DEFAULT '🌸',
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_progress (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        TEXT NOT NULL,
  lesson_id       INTEGER NOT NULL,
  module          TEXT NOT NULL,
  mastery_percent REAL NOT NULL DEFAULT 0,
  total_items     INTEGER,
  last_studied_at TEXT,
  updated_at      TEXT NOT NULL,
  UNIQUE (owner_id, lesson_id, module)
);
CREATE INDEX IF NOT EXISTS idx_learning_progress_owner ON learning_progress (owner_id);

CREATE TABLE IF NOT EXISTS mastery_status (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        TEXT NOT NULL,
  lesson_id       INTEGER NOT NULL,
  module          TEXT NOT NULL,
  item_key        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('mastered', 'fuzzy', 'weak', 'new')),
  review_count    INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (owner_id, lesson_id, module, item_key)
);
CREATE INDEX IF NOT EXISTS idx_mastery_status_owner ON mastery_status (owner_id);
CREATE INDEX IF NOT EXISTS idx_mastery_status_lookup ON mastery_status (owner_id, lesson_id, module);

CREATE TABLE IF NOT EXISTS wrong_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        TEXT NOT NULL,
  lesson_id       INTEGER NOT NULL,
  module          TEXT NOT NULL,
  question        TEXT NOT NULL,
  user_answer     TEXT,
  correct_answer  TEXT NOT NULL,
  error_reason    TEXT,
  status          TEXT NOT NULL DEFAULT 'weak' CHECK (status IN ('mastered', 'weak')),
  question_type   TEXT,
  source_type     TEXT,
  knowledge_keys  TEXT, -- JSON array
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_owner ON wrong_answers (owner_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_scope ON wrong_answers (owner_id, lesson_id, module);

CREATE TABLE IF NOT EXISTS study_sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id          TEXT NOT NULL,
  date              TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  module            TEXT,
  lesson_id         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_owner ON study_sessions (owner_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions (owner_id, date);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  lesson_id       INTEGER NOT NULL,
  module          TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  question_type   TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_count   INTEGER NOT NULL,
  accuracy        REAL NOT NULL,
  target_labels   TEXT, -- JSON array
  results         TEXT NOT NULL, -- JSON array
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_owner ON quiz_sessions (owner_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_lookup ON quiz_sessions (owner_id, lesson_id, module);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  lesson_id       INTEGER NOT NULL,
  module          TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner ON ai_conversations (owner_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations (owner_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  owner_id        TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_owner ON ai_messages (owner_id);

CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL UNIQUE,
  owner_id        TEXT NOT NULL,
  summary         TEXT NOT NULL,
  message_count   INTEGER NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_owner ON ai_conversation_summaries (owner_id);

CREATE TABLE IF NOT EXISTS ai_long_term_memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('preference', 'weak_point', 'goal', 'summary')),
  text        TEXT NOT NULL,
  score       REAL NOT NULL DEFAULT 0,
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_memories_owner ON ai_long_term_memories (owner_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_kind ON ai_long_term_memories (owner_id, kind);

CREATE TABLE IF NOT EXISTS system_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('account', 'quiz', 'settings', 'system')),
  level       TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message     TEXT NOT NULL,
  metadata    TEXT, -- JSON object
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_logs_owner ON system_logs (owner_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_lookup ON system_logs (owner_id, category, level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at);

-- ========================================================================
-- 认证 / 订阅 / 配额
-- ========================================================================

-- 会话：cookie jpquiz-sid 的服务端记录
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,            -- 32 字节随机 hex，存入 cookie
  user_id      TEXT NOT NULL,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL,             -- ms timestamp
  expires_at   INTEGER NOT NULL,             -- ms timestamp
  FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- 短信验证码
CREATE TABLE IF NOT EXISTS phone_verifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL,
  code_hash     TEXT NOT NULL,                -- sha256(code)
  ip            TEXT,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  consumed_at   INTEGER                       -- NULL 表示未使用
);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications (phone, created_at);

-- 月度 AI 调用计数（按 tier 决定上限）
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  user_id     TEXT NOT NULL,
  year_month  TEXT NOT NULL,                  -- YYYY-MM, 月份滚动靠这个字符串自然分桶
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month),
  FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_user ON ai_usage_monthly (user_id);

-- 管理员全平台模型配置（singleton）。所有用户走同一套上游 API key/provider/model
CREATE TABLE IF NOT EXISTS admin_model_config (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  provider          TEXT NOT NULL,            -- openrouter / openai / kimi / deepseek / custom
  base_url          TEXT NOT NULL,
  api_key           TEXT NOT NULL,            -- 明文存（仅服务端持有，不下发客户端）
  model             TEXT NOT NULL,
  wire_api          TEXT NOT NULL DEFAULT 'chat' CHECK (wire_api IN ('chat', 'responses')),
  reasoning_effort  TEXT,
  updated_at        INTEGER NOT NULL,
  updated_by        TEXT
);

-- 旧的 ai_usage_daily 废弃，保留空表防破坏老 build；不再写入
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_id   TEXT NOT NULL,
  date      TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE
);

-- 订阅订单
CREATE TABLE IF NOT EXISTS subscription_orders (
  id            TEXT PRIMARY KEY,             -- e.g. "JP20260509-AB12CD"
  user_id       TEXT NOT NULL,
  plan          TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount_cents  INTEGER NOT NULL,             -- 单位：分
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'activated', 'cancelled')),
  user_note     TEXT,                         -- 用户报告付款时填的备注（如 zfb 流水号尾号）
  created_at    INTEGER NOT NULL,
  paid_at       INTEGER,                      -- 用户点「已付款」时间
  activated_at  INTEGER,                      -- 管理员激活时间
  activated_by  TEXT,                         -- 激活者 user_id
  FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON subscription_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders (status, created_at);

-- 密码重置申请留言箱：用户密保答错锁账户后，向管理员留言申请重置；管理员定期审批
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  username     TEXT NOT NULL,                  -- 冗余存一份，admin 直接看
  message      TEXT,                           -- 用户留言（联系方式等）
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  created_at   INTEGER NOT NULL,
  processed_at INTEGER,
  processed_by TEXT,                           -- 处理的 admin user_id
  FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_status ON password_reset_requests (status, created_at);
