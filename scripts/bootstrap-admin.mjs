#!/usr/bin/env node
/**
 * 老账号迁移 / admin 引导脚本
 *
 * 新认证体系（用户名 + 密码 + 密保）启用后，老账号没有 username/password 无法登录。
 * 此脚本以 CLI 交互方式给指定账号补上这些字段。
 *
 * 用法：node scripts/bootstrap-admin.mjs
 *
 * 交互流程：
 *   1. 列出现有账号
 *   2. 选一个 → 设 username / password / 密保问题 / 密保答案
 *   3. 写入 SQLite（直接调 better-sqlite3，无需走 API）
 */

import readline from "node:readline";
import { Writable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "data", "jpquiz.db");

const BCRYPT_COST = 10;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN_LENGTH = 6;

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function ask(question, { silent = false } = {}) {
  // silent: 输入密码时不回显
  const muted = new Writable({
    write(chunk, _enc, cb) {
      if (!silent) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output: silent ? muted : process.stdout,
    terminal: true,
  });
  process.stdout.write(question);
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      if (silent) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

function hashSecurityAnswer(answer) {
  return bcrypt.hashSync(answer.trim().toLowerCase(), BCRYPT_COST);
}

async function main() {
  console.log("\n🌸 JPQuiz 账号引导脚本\n");

  const db = openDb();

  // 列出账号
  const accounts = db
    .prepare(
      `SELECT id, display_name, role, username, phone, last_active_at,
              account_locked_at, password_reset_pending
         FROM user_profiles
         WHERE id != 'local-default'
         ORDER BY last_active_at DESC`
    )
    .all();

  if (accounts.length === 0) {
    console.log("⚠️  数据库中暂无任何账号。请先在 /register 页面注册一个，或手动 INSERT。");
    process.exit(0);
  }

  console.log("现有账号：");
  accounts.forEach((a, i) => {
    const tags = [];
    if (a.role === "admin") tags.push("admin");
    if (a.username) tags.push(`username=${a.username}`);
    else tags.push("无 username");
    if (a.account_locked_at) tags.push("已锁定");
    if (a.password_reset_pending) tags.push("待重置");
    console.log(
      `  [${i + 1}] ${a.display_name}  (${tags.join(", ")})  id=${a.id.slice(0, 8)}...`
    );
  });

  const idxInput = await ask("\n选择账号编号: ");
  const idx = Number(idxInput) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= accounts.length) {
    console.error("❌ 无效编号");
    process.exit(1);
  }
  const account = accounts[idx];
  console.log(`\n→ 已选: ${account.display_name} (${account.id})`);

  // username
  let username = await ask(
    `用户名 [${account.username || "(留空跳过)"}]: `
  );
  username = username.trim();
  if (!username && account.username) {
    username = account.username; // 沿用旧值（多半是已经设过、再来改密码场景）
  }
  if (username && !USERNAME_REGEX.test(username)) {
    console.error("❌ 用户名 3-20 位字母 / 数字 / 下划线");
    process.exit(1);
  }
  if (username && username !== account.username) {
    const taken = db
      .prepare(
        "SELECT 1 FROM user_profiles WHERE username = ? AND id != ? LIMIT 1"
      )
      .get(username, account.id);
    if (taken) {
      console.error(`❌ 用户名 "${username}" 已被占用`);
      process.exit(1);
    }
  }

  // password
  const password = await ask("密码（输入不回显）: ", { silent: true });
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`❌ 密码至少 ${PASSWORD_MIN_LENGTH} 位`);
    process.exit(1);
  }
  const password2 = await ask("再次输入密码: ", { silent: true });
  if (password !== password2) {
    console.error("❌ 两次输入的密码不一致");
    process.exit(1);
  }

  // security
  const securityQuestion = await ask("密保问题（如：我家狗的名字）: ");
  if (!securityQuestion.trim()) {
    console.error("❌ 密保问题不能为空");
    process.exit(1);
  }
  const securityAnswer = await ask("密保答案: ");
  if (!securityAnswer.trim()) {
    console.error("❌ 密保答案不能为空");
    process.exit(1);
  }

  // 写库（顺便清掉锁 / pending 状态）
  db.prepare(
    `UPDATE user_profiles
       SET username = ?,
           password_hash = ?,
           security_question = ?,
           security_answer_hash = ?,
           failed_recovery_attempts = 0,
           account_locked_at = NULL,
           password_reset_pending = 0
     WHERE id = ?`
  ).run(
    username || null,
    hashPassword(password),
    securityQuestion.trim().slice(0, 200),
    hashSecurityAnswer(securityAnswer),
    account.id
  );

  console.log(`\n✅ 完成。可用以下凭证登录：`);
  console.log(`   username: ${username || "（保持原值）"}`);
  console.log(`   password: ${"*".repeat(password.length)}`);
  console.log(`\n下一步：浏览器访问 /login 输入用户名 + 密码即可。\n`);
  db.close();
}

main().catch((err) => {
  console.error("脚本执行出错:", err);
  process.exit(1);
});
