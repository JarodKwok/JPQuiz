# JPQuiz

一个基于 `Next.js 16` 的日语学习应用，围绕《大家的日语》课次组织内容，支持 AI 生成学习材料、专题内"学习 / 测验"双模式、智能组卷、掌握度追踪、错题与学习记录。后端使用服务端 SQLite 持久化用户与学习数据，前端搭配 IndexedDB 本地缓存。

## 功能概览

- 课次切换：按第 `1`–`25` 课切换当前学习上下文
- 四个学习模块：`vocabulary`、`grammar`、`text`、`examples`
- 双模式专题页：每个专题都支持 `学习` 和 `测验` 两种模式
- 学习内容内置：`1`–`25` 课全部模块都使用固定内置内容，切课无需再依赖 AI
- 智能组卷：支持当前范围随机、指定目标、错题/薄弱项、混合强化
- 固定题型：`选择题`、`填空题`、`问答题（翻译）`
- 预制题库 + AI 兜底：题库优先秒出，题库不够时再回退 AI 生成
- AI 助手抽屉：右侧可拉出的 AI 陪练面板，支持多轮对话、当前课次上下文、长期记忆
- 学习追踪：记录掌握度、学习时长、错题、测验结果与 AI 学情总结

## 账户与会员

- **登录方式**：用户名 + 密码 + 自定义密保问题（无需手机号 / 邮箱）
- **找回密码**：自助密保答题；连续答错 5 次锁账户，可向管理员留言申请人工重置
- **会员体系**：FREE 用户每月 AI 配额 0；PREMIUM 会员 100 次 / 月（在 `src/lib/db/config.ts` 调整）
- **付费**：支付宝个人收款码扫码 → 用户填订单号后 6 位 → 管理员后台手动核单激活
- **过期降级**：cron 每日扫到期会员自动降回 FREE（`/api/cron/check-expiry`，需 `X-Cron-Secret` 头）

第一个真实注册账号自动获得 `admin` 角色。后续 admin 在 `/admin/users` 给其他用户授权。

## 管理员后台（`/admin/*`）

| 路径 | 用途 |
|---|---|
| `/admin` | 仪表盘：用户数、会员数、本月 AI 用量、临到期会员等 |
| `/admin/users` | 用户管理：tier 徽章、本月用量、一键开通 / 吊销会员、设/取消管理员 |
| `/admin/orders` | 订单管理：用户报付订单核单、激活 / 作废 |
| `/admin/password-resets` | 密码重置申请审核：批准 = 解锁 + 标记重置（用户下次登录被引导设新密码） |
| `/admin/settings` | 平台 AI 模型配置：provider / baseUrl / apiKey / model（不下发客户端） |
| `/admin/logs` | 系统日志：账户 / 测验 / 设置 / 系统 多类别 |

侧边栏会自动按当前路径切换前 / 后台菜单；admin 角色额外有「进入管理后台」/「返回学习」切换链接。

## 技术栈

- `Next.js 16` + Turbopack（注意 middleware 已重命名为 `proxy.ts`）
- `React 19` / `TypeScript 5.9` / `Tailwind CSS 4`
- 服务端：`better-sqlite3`（WAL 模式）/ `bcryptjs` 密码哈希
- 前端状态：`Zustand` / IndexedDB（`dexie` 本地缓存）
- 测试：`Vitest`

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址 `http://localhost:3000`。

### 服务启停（推荐）

```bash
npm run app:up        # 构建并后台启动预览服务（端口 3006）
npm run app:restart   # 重建并重启
npm run app:status
npm run app:logs
npm run app:stop
```

开发模式（hot reload）：

```bash
npm run app:dev:up    # 端口 3007
npm run app:dev:logs
npm run app:dev:stop
```

支持临时改端口 `JPQUIZ_PORT=3010 npm run app:up`。脚本将 PID / 日志写入 `.runtime/`。

## 首次部署

1. `git clone` + `npm install` + `npm run build`
2. **配置环境变量**：`cp .env.example .env.local`，至少填 `CRON_SECRET`（生成 `openssl rand -hex 32`）；推荐再填 `JPQUIZ_AUTH_SECRET` 让重启后已发出的 reset cookie 仍有效
3. **启动服务**：`npm run app:up`
4. **创建首个 admin**：浏览器 `/register` 注册一个账号（首位真实账号自动 admin），或用旧 DB 时跑 `node scripts/bootstrap-admin.mjs` 给老账号补 username/password
5. **配置 AI 模型**：admin 登录 → `/admin/settings` 填上游 provider / apiKey / model（推荐 OpenRouter）
6. **放置收款码**：把支付宝个人「固定金额」收款码导出为 `alipay-monthly.png` / `alipay-yearly.png`，放到 `public/qr/` 覆盖占位图

## 可用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run generate:questions    # 重建预制题库
npm run build:questions
node scripts/bootstrap-admin.mjs   # 老账号补 username/password
```

## 数据存储

**服务端 SQLite**（`data/jpquiz.db`，schema 见 `src/lib/db/schema.sql`）：
- `user_profiles`（含 username / password_hash / 密保 / tier / pending 标记）
- `sessions`（HttpOnly cookie 对应记录，30 天滚动续期）
- `learning_progress` / `mastery_status` / `wrong_answers` / `study_sessions` / `quiz_sessions`
- `ai_conversations` / `ai_messages` / `ai_conversation_summaries` / `ai_long_term_memories`
- `ai_usage_monthly`（按 `YYYY-MM` 分桶的配额计数）
- `subscription_orders`（订单 + 激活记录）
- `password_reset_requests`（用户向 admin 的留言箱）
- `admin_model_config`（singleton 平台模型配置）
- `system_logs`

**客户端 IndexedDB**（`dexie`）作为题库 / 临时缓存，首次进入时通过 `src/services/migration.ts` 一次性迁移老数据到服务端。

## 文档

- `PRD/prd.md` — 产品需求
- `PRD/architecture.md` — 技术架构
- `PRD/tech-spec.md` — 技术规范
- `PRD/ai-design.md` — AI 分层与记忆设计
- `PRD/resource.md` — 内容 / 音频资源
