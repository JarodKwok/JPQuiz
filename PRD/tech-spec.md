# 技术方案文档

## 一、技术栈选型

| 层级 | 技术选型 | 说明 |
| --- | --- | --- |
| **前端框架** | Next.js 14 (App Router) + TypeScript | SSR/SSG 支持，路由内置，生态成熟 |
| **UI 组件库** | shadcn/ui + Radix UI | 高质量无样式原语组件，完全可定制 |
| **样式方案** | Tailwind CSS | 高效开发，与 shadcn/ui 天然配合 |
| **状态管理** | Zustand | 轻量、TS 友好，适合中小型应用 |
| **本地存储** | IndexedDB（via Dexie.js） | 浏览器端结构化存储，存学习进度、掌握状态、错题 |
| **AI 模型调用** | 统一抽象层 + 可配置 Provider | 见下方详细设计 |
| **TTS 语音合成** | Web Speech API（本地）/ 云端 TTS API | P2 阶段再接入高质量日语 TTS |
| **部署** | Cloudflare Pages | 无限带宽，全球 CDN，国内访问友好 |

---

## 二、AI 模型抽象层设计（核心）

### 2.1 设计目标

- API Key 可配置，用户可在设置页面填入自己的 Key
- 模型 Provider 可切换，无需改代码
- 新增模型供应商只需实现统一接口

### 2.2 架构设计

```
┌─────────────────────────────────────┐
│           App 业务层                 │
│  (单词学习 / 语法 / 课文 / 出题)     │
└──────────────┬──────────────────────┘
               │ 调用统一接口
               ▼
┌─────────────────────────────────────┐
│        AIService (抽象层)            │
│  - chat(messages, options)          │
│  - stream(messages, options)        │
│  - getModels()                      │
└──────────────┬──────────────────────┘
               │ 根据配置分发
        ┌──────┼──────┐
        ▼      ▼      ▼
   ┌────────┐┌─────┐┌────────┐
   │ OpenAI ││Kimi ││DeepSeek│  ← 各 Provider 实现
   │Adapter ││Adapt││Adapter │
   └────────┘└─────┘└────────┘
```

### 2.3 统一接口定义

```typescript
// types/ai.ts
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIProvider {
  name: string;
  chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse>;
  stream(messages: AIMessage[], options?: AIRequestOptions): AsyncIterable<string>;
}

// 模型配置
export interface AIModelConfig {
  provider: 'openai' | 'kimi' | 'deepseek';
  model: string;       // 具体模型名，如 "gpt-5.4", "moonshot-v1-8k", "deepseek-chat"
  apiKey: string;
  baseUrl?: string;     // 可选，自定义 API 地址
}
```

### 2.4 API Key 安全说明

由于是纯前端 Web 应用，API Key 存储在浏览器 localStorage 中，仅在客户端使用。

- **直连模式（MVP）**：前端直接调用 AI 供应商 API，需供应商支持 CORS
- **代理模式（推荐）**：通过 Next.js API Route (`/api/ai/chat`) 代理转发请求，API Key 存在服务端环境变量中，更安全

```typescript
// 配置持久化存储在 localStorage
{
  "ai": {
    "activeProvider": "openai",
    "providers": {
      "openai": {
        "apiKey": "sk-xxx",
        "model": "gpt-5.4",
        "baseUrl": "https://api.openai.com/v1"
      },
      "kimi": {
        "apiKey": "sk-xxx",
        "model": "moonshot-v1-8k",
        "baseUrl": "https://api.moonshot.cn/v1"
      },
      "deepseek": {
        "apiKey": "sk-xxx",
        "model": "deepseek-chat",
        "baseUrl": "https://api.deepseek.com/v1"
      }
    }
  }
}
```

> **说明**：Kimi 和 DeepSeek 均兼容 OpenAI API 格式，实际 Provider 实现可复用 OpenAI Adapter，只需切换 `baseUrl` 和 `model`。

---

## 三、数据存储方案

### 3.1 IndexedDB 数据结构（via Dexie.js）

```typescript
// db.ts
import Dexie, { type Table } from 'dexie';

interface LearningProgress {
  id?: number;
  lessonId: number;          // 课次编号 (1-25)
  module: 'vocabulary' | 'grammar' | 'text' | 'example' | 'listening';
  masteryPercent: number;     // 熟练度百分比
  lastStudiedAt?: string;
  updatedAt: string;
}

interface MasteryStatus {
  id?: number;
  lessonId: number;
  module: string;
  itemKey: string;            // 知识点标识 (如单词原文、语法编号)
  status: 'mastered' | 'fuzzy' | 'weak' | 'new';
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}

interface WrongAnswer {
  id?: number;
  lessonId: number;
  module: string;
  question: string;
  userAnswer?: string;
  correctAnswer: string;
  errorReason?: string;
  status: 'mastered' | 'weak';
  createdAt: string;
}

interface StudySession {
  id?: number;
  date: string;               // YYYY-MM-DD
  durationSeconds: number;
  module?: string;
  lessonId?: number;
}

class JPQuizDB extends Dexie {
  learningProgress!: Table<LearningProgress>;
  masteryStatus!: Table<MasteryStatus>;
  wrongAnswers!: Table<WrongAnswer>;
  studySessions!: Table<StudySession>;

  constructor() {
    super('jpquiz');
    this.version(1).stores({
      learningProgress: '++id, lessonId, module',
      masteryStatus: '++id, lessonId, module, status',
      wrongAnswers: '++id, lessonId, module, status',
      studySessions: '++id, date, module',
    });
  }
}
```

### 3.2 存储策略

- **MVP 阶段**：纯浏览器 IndexedDB，无需注册登录
- **后续扩展**：接入 Supabase 实现云端同步 + 多设备支持，IndexedDB 作为离线缓存

---

## 四、课次范围明确

《大家的日语》初级 I（第 1 ~ 25 课）覆盖 N5 核心内容，**MVP 版本支持第 1 ~ 25 课**。

---

## 五、Web 端页面布局

### 5.1 桌面端（≥ 1024px）

```
┌─────────────────────────────────────────────────────────┐
│  顶部导航栏：Logo + 课次选择 + 进度概览 + 设置齿轮       │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  左侧边栏   │              主内容区                      │
│  (240px)   │     (学习内容 / 练习 / AI 对话)             │
│            │                                            │
│  · 单词    │                                            │
│  · 语法    │                                            │
│  · 课文    │                                            │
│  · 例句    │                                            │
│  · 听力    │                                            │
│  ─────── │                                            │
│  · 薄弱本  │                                            │
│  · 学习记录 │                                            │
│            ├────────────────────────────────────────────┤
│            │  AI 交互输入栏（固定底部）                    │
├────────────┴────────────────────────────────────────────┤
```

### 5.2 移动端（< 768px）

- 左侧边栏收起为汉堡菜单（点击展开 overlay）
- 主内容区全屏宽
- AI 输入栏固定底部
- 课次选择改为下拉 Select

---

## 六、路由设计

```
/                       → 首页（重定向到上次学习模块）
/vocabulary?lesson=3    → 单词学习（第 3 课）
/grammar?lesson=5       → 语法精讲（第 5 课）
/text?lesson=2          → 课文学习（第 2 课）
/examples?lesson=4      → 例句练习（第 4 课）
/listening?lesson=1     → 听力训练（第 1 课）
/weak-points            → 薄弱 / 错题本
/history                → 学习记录
/settings               → 设置页（AI Provider / API Key / Model 配置）
```

---

## 七、AI 响应策略

| 场景 | 策略 |
| --- | --- |
| 内容生成（单词列表、语法讲解） | **流式输出（stream）**，首 token ≤ 1s，逐步渲染 |
| 练习题出题 | 流式输出，题目逐题显示 |
| 掌握状态标记 | 纯本地操作，无需 AI 调用 |
| 指令解析失败 | 返回预设引导提示，给出指令示例 |

---

## 八、项目目录结构

```
JPQuiz/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # 根布局（侧边栏 + 顶栏 + AI 输入栏）
│   │   ├── page.tsx             # 首页（重定向）
│   │   ├── vocabulary/
│   │   │   └── page.tsx         # 单词学习
│   │   ├── grammar/
│   │   │   └── page.tsx         # 语法精讲
│   │   ├── text/
│   │   │   └── page.tsx         # 课文学习
│   │   ├── examples/
│   │   │   └── page.tsx         # 例句练习
│   │   ├── listening/
│   │   │   └── page.tsx         # 听力训练
│   │   ├── weak-points/
│   │   │   └── page.tsx         # 薄弱 / 错题本
│   │   ├── history/
│   │   │   └── page.tsx         # 学习记录
│   │   ├── settings/
│   │   │   └── page.tsx         # 设置页
│   │   └── api/
│   │       └── ai/
│   │           └── chat/
│   │               └── route.ts # AI 代理接口（流式转发）
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # 左侧边栏
│   │   │   ├── TopNav.tsx       # 顶部导航栏
│   │   │   └── AIInputBar.tsx   # AI 交互输入栏
│   │   ├── lesson/
│   │   │   ├── LessonSelector.tsx
│   │   │   └── MasteryButtons.tsx
│   │   └── ui/                  # shadcn/ui 组件
│   ├── services/
│   │   ├── ai/
│   │   │   ├── types.ts         # AI 接口类型定义
│   │   │   ├── provider.ts      # AIService 抽象层
│   │   │   └── openai-adapter.ts # OpenAI 兼容 adapter（通用）
│   │   ├── db.ts                # Dexie.js IndexedDB 封装
│   │   └── prompts.ts           # System prompt 模板
│   ├── stores/
│   │   ├── lessonStore.ts
│   │   ├── progressStore.ts
│   │   └── settingsStore.ts
│   └── types/
│       └── index.ts
├── public/
├── PRD/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 九、MVP 范围（P0）

| 功能 | 说明 |
| --- | --- |
| 课次选择 | 第 1-25 课，单课选择 |
| 单词学习 | 查看模式 + 选择题模式 + 掌握标记 |
| 语法精讲 | 语法列表 + 详情 + 基础练习题 |
| 课文学习 | 课文展示 + 对照翻译 |
| AI 交互 | 文字输入指令，流式输出响应 |
| 进度跟踪 | IndexedDB 记录，状态栏展示 |
| 设置页 | AI Provider / API Key / Model 配置 |
| 响应式 | 桌面端侧边栏布局，移动端汉堡菜单适配 |
