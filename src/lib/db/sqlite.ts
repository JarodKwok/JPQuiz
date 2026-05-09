import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "jpquiz.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  _db.exec(schema);

  applyAdditiveMigrations(_db);

  return _db;
}

/**
 * SQLite 不支持 IF NOT EXISTS 的 ALTER TABLE，所以用 PRAGMA 内省手动幂等。
 * 只允许 additive 操作（新增列、新增索引），不做破坏性变更。
 */
function applyAdditiveMigrations(db: Database.Database) {
  ensureColumn(db, "user_profiles", "phone", "TEXT");
  ensureColumn(db, "user_profiles", "tier", "TEXT NOT NULL DEFAULT 'free'");
  ensureColumn(db, "user_profiles", "tier_expires_at", "INTEGER");
  ensureColumn(db, "user_profiles", "registered_at", "INTEGER");

  // 用户名 + 密码 + 密保认证体系
  ensureColumn(db, "user_profiles", "username", "TEXT");
  ensureColumn(db, "user_profiles", "password_hash", "TEXT");
  ensureColumn(db, "user_profiles", "security_question", "TEXT");
  ensureColumn(db, "user_profiles", "security_answer_hash", "TEXT");
  ensureColumn(db, "user_profiles", "failed_recovery_attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_profiles", "account_locked_at", "INTEGER");
  ensureColumn(db, "user_profiles", "password_reset_pending", "INTEGER NOT NULL DEFAULT 0");

  // 手机号唯一索引（NULL 不参与唯一性）
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles (phone) WHERE phone IS NOT NULL"
  );
  // 用户名唯一索引（NULL 不参与，便于老账号迁移期共存）
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (username) WHERE username IS NOT NULL"
  );
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
