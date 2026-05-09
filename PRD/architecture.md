# 大家的日语 AI陪练 — 技术架构文档

> 描述应用的技术选型、目录结构、数据流、类型系统及核心服务实现。
> 更新时间：2026-05-09

---

## 一、技术栈

| 层次 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Next.js | ^16.2 | App Router + Turbopack，注意 middleware 已重命名为 `proxy.ts` |
| 语言 | TypeScript | ^5.9 | 全栈类型安全 |
| UI | React | ^19.2 | 组件渲染 |
| 样式 | Tailwind CSS | ^4.2 | 原子化 CSS |
| 组件图标 | lucide-react | ^0.577 | 统一图标库 |
| 服务端数据库 | better-sqlite3 (WAL) | ^12.9 | 用户 / 会话 / 学习数据 / AI 用量 / 订单 / 系统日志权威存储 |
| 客户端缓存 | Dexie (IndexedDB) | ^4.3 | 题库与本地缓存，首次进入自动迁移到服务端 |
| 密码哈希 | bcryptjs | ^2.4 | 纯 JS bcrypt，无原生编译依赖 |
| 全局状态 | Zustand | ^5.0 | 轻量客户端状态管理 |
| Markdown 渲染 | react-markdown + remark-gfm | ^10 / ^4 | AI 回答 Markdown 渲染 |
| 音频 TTS | Edge TTS (`edge-tts`) | Python | 离线预生成词汇/例句/课文音频 |
| 测试 | Vitest | ^3.2 | 单元测试 |

---

## 二、目录结构

```
JPQuiz/
├── books/
│   ├── book1.md                  # 唯一权威教材来源（25 课 Markdown）
│   └── audio/                    # 词汇/例句/句型音频（内容命名，不入 Git）
│       ├── manifest.json         # 词汇音频索引
│       ├── examples_manifest.json# 例句/句型音频索引
│       └── lesson_XX/
│           ├── vocab_*.mp3
│           ├── example_*.mp3
│           └── pattern_*.mp3
│
├── public/
│   ├── qr/                       # 个人收款码图（alipay-monthly.png 等）
│   └── audio/
│       └── lessons/              # 课文音频（索引命名，不入 Git）
│           ├── index.json
│           └── lesson_XX/
│               └── text_000.mp3
│
├── scripts/
│   ├── parse-book1.mjs           # book1.md → builtin-content.ts
│   ├── migrate_vocab_audio.py    # 词汇音频迁移/生成
│   ├── generate_books_audio.py   # 词汇音频全量重生成
│   ├── migrate_examples_audio.py # 例句/句型音频生成
│   ├── generate_edge_tts.py      # 课文音频生成
│   ├── test_audio.py             # 音频完整性自动化测试
│   └── bootstrap-admin.mjs       # 老账号 username/password 引导（CLI）
│
├── src/
│   ├── proxy.ts                  # Next.js 16 边缘代理（cookie 检查 + 路由保护）
│   ├── app/                      # Next.js App Router 页面
│   │   ├── layout.tsx            # 根布局（metadata、AppShell）
│   │   ├── page.tsx              # 首页（课次选择）
│   │   ├── (auth)/               # 公开路由组：login / register / forgot-password
│   │   ├── (app)/                # 已登录路由组：业务页面
│   │   │   ├── vocabulary / grammar / examples / text
│   │   │   ├── weak-points / history
│   │   │   ├── subscribe         # 用户开通会员（扫支付宝码报付）
│   │   │   ├── account/reset-required  # 被 admin 批准后强制重设页
│   │   │   └── admin/            # 管理后台 dashboard / users / orders / password-resets / settings / logs
│   │   └── api/
│   │       ├── auth/             # register / login / logout / me / forgot/* / reset-after-approval / suggest-username
│   │       ├── orders/           # 用户侧 report-paid / my
│   │       ├── admin/            # users / orders / password-resets / model-config
│   │       ├── ai/               # chat / quota
│   │       ├── cron/check-expiry # 定时任务（X-Cron-Secret 鉴权）
│   │       ├── db/               # 客户端遗留 db proxy（迁移期）
│   │       └── audio/books/[...path]/route.ts
│   │
│   ├── components/
│   │   ├── layout/               # AppShell、Sidebar、TopNav
│   │   ├── lesson/               # 课次相关 UI 组件
│   │   ├── quiz/                 # 测验 UI 组件
│   │   └── ui/                   # 通用 UI 原语
│   │
│   ├── data/
│   │   └── builtin-content.ts    # 应用内容数据层（由脚本生成，221KB）
│   │
│   ├── hooks/                    # React 自定义 Hooks
│   ├── lib/                      # 工具函数
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.sql        # SQLite 表结构（用户 / 会话 / 学习 / AI / 订单 / 日志）
│   │   │   ├── sqlite.ts         # 数据库单例 + 幂等 ALTER TABLE 迁移
│   │   │   ├── server-user.ts    # getServerUserId / requireAdminUserId
│   │   │   ├── reset-token.ts    # 忘记密码 HMAC 临时签名
│   │   │   ├── config.ts         # MAX_RECOVERY_ATTEMPTS / 配额 / 价格
│   │   │   └── repos/            # auth / admin / subscription / ai / mastery / wrong / progress / quiz / log
│   │   └── utils.ts
│   │
│   ├── services/
│   │   ├── account.ts            # 客户端账户 API
│   │   ├── audio.ts              # 音频播放服务（三级降级）
│   │   ├── content.ts            # 内容访问封装
│   │   ├── db.ts                 # Dexie 数据库定义（题库 / 客户端缓存）
│   │   ├── migration.ts          # IndexedDB → 服务端 SQLite 一次性迁移
│   │   ├── events.ts             # 全局事件总线
│   │   ├── mastery.ts            # 掌握度管理
│   │   ├── progress.ts           # 学习进度统计
│   │   ├── prompts.ts            # AI 系统提示词
│   │   ├── quiz.ts               # 题目生成逻辑（题库优先 → AI 兜底）
│   │   ├── question-bank.ts      # 预制题库读取
│   │   ├── secure-settings.ts    # 已废弃的客户端 AI 设置（将移除）
│   │   ├── wrongAnswers.ts       # 错题管理
│   │   ├── systemLog.ts          # 客户端日志上报
│   │   ├── account.ts / adminStats.ts
│   │   └── ai/
│   │       ├── client.ts         # AI API 调用客户端（流式 + AIRequestError 类型化错误）
│   │       ├── memory.ts         # 对话记忆（短期/长期）
│   │       ├── route-utils.ts    # AI API 路由工具
│   │       ├── settings.ts       # AI 设置标准化（多走 admin 后台）
│   │       └── tutor.ts          # 导师 System Prompt 构建
│   │
│   ├── stores/                   # Zustand：account / lesson / module-ui
│   └── types/
│       ├── index.ts              # 全局类型（Module 等）
│       ├── account.ts            # UserProfile / AccountTier
│       ├── content.ts            # 内容类型（VocabularyItem 等）
│       ├── log.ts / quiz.ts
│       └── quiz.ts
│
└── PRD/
    ├── prd.md                    # 产品需求文档
    ├── resource.md               # 资源衔接文档
    ├── tech-spec.md              # 技术规范
    ├── ai-design.md              # AI 分层与记忆设计
    └── architecture.md           # 本文件（技术架构文档）
```

---

## 三、数据流

### 3.1 内容加载流

```
books/book1.md
    │
    ▼  node scripts/parse-book1.mjs（构建时手动执行）
    │
src/data/builtin-content.ts
    │   Record<number, BuiltinLessonContent>（静态 TS 对象）
    │
    ▼  getBuiltinModuleContent(lessonId, module)
    │
页面组件（vocabulary/page.tsx 等）
    │
    ▼  渲染 + 播放音频（speakVocab / speakExample / speak）
```

### 3.2 音频播放流

```
用户点击播放
    │
    ▼
src/services/audio.ts
    │
    ├── speakVocab(text, lessonId, reading)
    │       └── GET /api/audio/books/lesson_XX/vocab_{reading}.mp3
    │               └── books/audio/lesson_XX/vocab_{reading}.mp3
    │
    ├── speakExample(text, lessonId, type)
    │       └── SHA-256(text)[:8] → hash
    │           GET /api/audio/books/lesson_XX/{type}_{hash}.mp3
    │               └── books/audio/lesson_XX/{example|pattern}_{hash}.mp3
    │
    └── speak(text, lessonId, type, index)
            └── GET /audio/lessons/lesson_XX/text_{NNN}.mp3
                    └── public/audio/lessons/lesson_XX/...（Next.js 静态）

降级链：预生成 MP3 → Web Speech API → 静默
```

### 3.3 AI 陪练数据流

```
用户发送消息
    │
    ▼
src/services/ai/tutor.ts（buildTutorConversationMessages）
    │
    ├── 服务端 admin_model_config        → AI 模型配置（apiKey / baseUrl / model，仅服务端持有）
    ├── getConversationContext()         → 最近 N 轮对话 + DB 摘要
    ├── buildLearnerSnapshotText()       → 进度快照（掌握度 / 错题 / 薄弱项）
    ├── listRelevantLongTermMemories()   → 长期记忆
    ├── buildModuleContextText()         → 当前课次内容摘要
    └── buildRequestShapeHint()          → 输出形态要求（表格/列表/简短）
            │
            ▼
    buildTutorSystemPrompt() → 组装 System Prompt
            │
            ▼
    streamAIText(messages, onDelta)
            │
            ▼
    POST /api/ai/chat
            ├── 鉴权：getServerUserId（Cookie 校验）
            ├── 配额：getMonthlyUsage(userId, YYYY-MM) vs tier 上限
            ├── 计数 +1（先扣后调，防滥用）
            └── 调用上游（OpenRouter / OpenAI / Kimi 等）→ 流式返回
            │
            ▼
    UI 实时渲染（react-markdown + remark-gfm）
```

### 3.4 学习进度持久化流

```
用户完成测验 / 标记掌握
    │
    ▼
src/services/mastery.ts
    │   updateMasteryStatus(lessonId, module, itemKey, status)
    │
    ▼
Dexie (IndexedDB)
    │   表：masteryStatus、learningProgress、wrongAnswers、
    │       studySessions、quizSessions、
    │       aiConversations、aiConversationMessages、
    │       aiConversationSummaries、aiLongTermMemories
    │
    ▼  读取
src/services/progress.ts
    │   getLessonProgressSummary(lessonId)
    │   getTodayStudyMinutes()
    │
    ▼
AI 导师快照 / 进度展示页面
```

---

## 四、核心类型定义

### 内容类型（`src/types/content.ts`）

```typescript
interface VocabularyItem {
  word: string;         // 显示单词（可能含汉字）
  reading: string;      // 假名读音（音频命名基准）
  meaning: string;      // 中文释义
  kanji?: string;       // 汉字形式（可选）
  example?: string;     // 例句（可选）
}

interface GrammarItem {
  id: string;           // "课号-序号" e.g. "1-1"
  name: string;         // 语法模式名称
  meaning: string;      // 含义说明
  connection: string;   // 接续规则
  example: string;      // 例句（日语）
  exampleTranslation: string;
  tip?: string;
}

interface ExampleItem {
  japanese: string;
  reading?: string;
  translation: string;
  grammar?: string;
}

interface PatternItem {
  id: string;
  pattern: string;
  meaning: string;
  structure?: string;
  sampleJapanese: string;
  sampleReading?: string;
  sampleTranslation: string;
}

interface TextItem {
  japanese: string;
  translation: string;
}

interface ListeningItem {
  text: string;
  answer?: string;
}
```

### 学习状态类型（`src/types/index.ts`）

```typescript
type Module = "vocabulary" | "grammar" | "text" | "examples";
type MasteryLevel = "mastered" | "fuzzy" | "weak" | "new";

interface MasteryStatus {
  lessonId: number;
  module: Module;
  itemKey: string;       // 词汇=reading, 语法=id, 课文=index
  status: MasteryLevel;
  reviewCount: number;
}
```

---

## 五、音频命名系统

| 类型 | 命名方式 | 示例 | 存储位置 |
|------|----------|------|----------|
| 词汇 | `vocab_{读音}.mp3`（空格→下划线，去`〜`） | `vocab_わたし.mp3` | `books/audio/lesson_XX/` |
| 例句 | `example_{SHA-256前8位}.mp3` | `example_a3f2b8c1.mp3` | `books/audio/lesson_XX/` |
| 句型 | `pattern_{SHA-256前8位}.mp3` | `pattern_3d7e9b02.mp3` | `books/audio/lesson_XX/` |
| 课文行 | `text_{NNN}.mp3`（三位序号） | `text_000.mp3` | `public/audio/lessons/lesson_XX/` |

**设计原则：**
- 词汇/例句/句型使用**内容命名**：内容不变则文件名不变，天然支持复用，课程重排不影响缓存
- 课文/听力使用**索引命名**：说话人顺序固定，按位置访问更直观

**SHA-256 Hash 一致性（Python ↔ TypeScript）：**

```python
# Python
import hashlib
hash8 = hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]
```

```typescript
// TypeScript
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
const hash8 = Array.from(new Uint8Array(buf))
  .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
```

---

## 六、AI 服务

### 6.1 Multi-Provider 架构

```
src/services/ai/provider.ts
    └── 支持任意 OpenAI-compatible API
        - OpenAI (gpt-4o, gpt-4.1 等)
        - Moonshot / Kimi (moonshot-v1-32k 等)
        - DeepSeek (deepseek-chat 等)
        - 其他兼容 /v1/chat/completions 的服务
```

配置通过 `src/services/secure-settings.ts` 加密存储在 `localStorage`（Base64 + 简单混淆）。

### 6.2 System Prompt 构建（`src/services/ai/tutor.ts`）

System Prompt 由以下 7 个区块动态拼接：

1. **安全硬边界**（BASE_TUTOR_SAFETY_PROMPT）：拒绝无关话题
2. **回答粒度控制**（TUTOR_RESPONSE_STYLE_PROMPT）：防止过度展开
3. **教师名称 + 角色定位**：来自用户设置
4. **教学风格**（concise / structured / coach）+ 格式偏好
5. **学习者快照**：当前课次进度、今日时长、薄弱项、最近错题
6. **课次内容摘要**：当前模块前 N 条内容（词汇/语法/例句等）
7. **对话记忆**：最近 N 轮 + DB 摘要 + 长期记忆

### 6.3 记忆层次

| 层次 | 实现 | 范围 |
|------|------|------|
| 短期（本轮对话） | `recentMessages`（最近 N 轮） | 当前 conversation |
| 中期（历史摘要） | `aiConversationSummaries`（IndexedDB） | 单个 conversation |
| 长期（跨课记忆） | `aiLongTermMemories`（IndexedDB） | 全局，按 score 排序 |

---

## 七、本地数据持久化

所有学习数据存储在浏览器 IndexedDB（通过 Dexie），**无服务端、无账户体系**。

| Dexie 表 | 主要字段 | 用途 |
|----------|----------|------|
| `masteryStatus` | lessonId, module, itemKey, status | 各条目掌握状态 |
| `learningProgress` | lessonId, module, masteryPercent | 模块级进度百分比 |
| `wrongAnswers` | lessonId, module, question, correctAnswer | 错题记录 |
| `studySessions` | date, durationSeconds | 学习时长统计 |
| `quizSessions` | lessonId, module, accuracy | 测验历史 |
| `aiConversations` | lessonId, module, title | AI 对话列表 |
| `aiConversationMessages` | conversationId, role, content | 对话消息 |
| `aiConversationSummaries` | conversationId, summary | 对话压缩摘要 |
| `aiLongTermMemories` | kind, text, score | 长期记忆条目 |

---

## 八、构建与运行

```bash
# 开发
npm run dev

# 构建
npm run build

# 类型检查
npx tsc --noEmit

# 单元测试
npx vitest run

# 重新生成内容数据层（教材更新后执行）
node scripts/parse-book1.mjs

# 音频生成（首次或更新后）
source venv313/bin/activate
python scripts/migrate_vocab_audio.py        # 词汇音频
python scripts/migrate_examples_audio.py     # 例句/句型音频
python scripts/generate_edge_tts.py          # 课文音频

# 音频完整性验证
python scripts/test_audio.py
```

---

## 九、认证与会员（v2 起）

| 维度 | 选择 |
|---|---|
| 注册 / 登录 | 用户名 + 密码 + 自定义密保问题（无邮箱 / 短信通道） |
| 会话 | HttpOnly cookie `jpquiz-sid` + 服务端 `sessions` 表，30 天滚动续期 |
| 密码哈希 | bcryptjs cost=10 |
| 找回密码 | 自助密保答题；连错 5 次锁账户 → 用户提交留言 → admin 后台批准 → 用户下次登录任意密码进强制重设页 |
| 会员 | FREE 0 配额 / PREMIUM 100 次/月，按 `YYYY-MM` 分桶在 `ai_usage_monthly` 计数 |
| 付费 | 支付宝个人收款码扫码 + 用户填订单号后 6 位 + admin 手动激活；订单生命周期表 `subscription_orders` |
| 会员到期 | cron `/api/cron/check-expiry`（X-Cron-Secret 鉴权）扫 `tier_expires_at < now` 自动降级 |
| Edge runtime 限制 | proxy.ts 只做 cookie 存在性检查；真正鉴权在 route handler 内 `getServerUserId` / `requireAdminUserId` |

---

## 十、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 学习内容存储 | 静态 TS 文件（`builtin-content.ts`） | 零部署依赖，启动即用 |
| 业务数据存储 | 服务端 SQLite（WAL）权威 + IndexedDB 客户端缓存 | 多端 / 多设备需要服务端真相，迁移期保留本地缓存路径 |
| 音频服务 | 预生成 MP3 + API Route | 比实时 TTS 响应快、成本低 |
| AI Provider | 平台统一配置（admin 后台），客户端不持有 Key | 用户零配置；防止 key 泄露；可不重启切 provider |
| 题库 vs AI | 题库优先 fast path；命中筛选不足时回退 AI | 0 成本秒出；冷门组合下保证有题 |
| 内容命名音频 | SHA-256 hash / 读音文本 | 内容变化自动失效，不受顺序影响 |
| 认证策略 | 用户名 + 密码 + 密保（拒绝邮箱 / SMS） | 个人开发者无运营商资质，无邮件打扰 |
| 付费策略 | 个人收款码 + 手动核单 | 无营业执照，无第三方聚合支付的合规风险 |
```
