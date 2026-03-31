# 技术方案文档

## 一、技术栈

| 层级 | 技术选型 | 说明 |
| --- | --- | --- |
| 前端框架 | Next.js 16 + React 19 + TypeScript | App Router，适合结构化页面与客户端交互 |
| 状态管理 | Zustand | 保存当前课次、当前专题、AI 设置 |
| 样式方案 | Tailwind CSS 4 | 快速构建专题页和题型 UI |
| 本地数据库 | IndexedDB（Dexie） | 保存内容缓存、掌握状态、错题、测验记录 |
| AI 调用 | OpenAI 兼容 Provider 抽象层 | 支持 OpenAI / Kimi / DeepSeek |
| 测试 | Vitest | 覆盖解析、进度统计、测验服务 |

---

## 二、系统架构

### 2.1 分层结构

```text
页面层
├─ 专题页（单词/语法/课文/例句/听力）
├─ 学习记录页
└─ AI 问答面板

组件层
├─ Study UI（现有学习内容）
├─ ModuleModeTabs
├─ ModuleQuizPanel
└─ StructuredQuiz

服务层
├─ content.ts        学习内容获取与缓存
├─ quiz.ts           目标识别 / AI 组卷 / 本地判题 / 测验持久化
├─ progress.ts       学习统计
├─ progress-insights.ts  AI 学情总结
├─ mastery.ts        掌握状态
└─ wrongAnswers.ts   错题记录

存储层
└─ Dexie / IndexedDB
```

### 2.2 双模式专题页

每个专题页统一分为：

- `study`：保留原学习内容
- `quiz`：进入智能组卷与答题流程

专题页不复用底部 AI 对话框作为正式测验入口。

---

## 三、AI 能力拆分

### 3.1 学习内容生成

由 `getModuleContent()` 负责：

- 按 `lessonId + module` 生成学习内容
- 使用内容缓存表 `contentCache`
- 返回结构化 JSON

### 3.2 目标识别

由 `resolveQuizTargets()` 负责：

- 输入：当前课次、当前专题、用户自然语言目标
- 结合当前专题候选知识点进行识别
- 支持中文 / 日文 / 假名 / 句子片段
- 输出：已识别的目标列表

### 3.3 智能组卷

由 `generateModuleQuiz()` 负责：

- 输入：课次、专题、题型、来源、题量、已识别目标
- 使用专用 Quiz Prompt
- 输出：严格结构化的测验 JSON

### 3.4 AI 学情总结

由 `generateProgressInsight()` 负责：

- 输入：结构化学习统计数据
- 输出：中文学习点评

### 3.5 AI Tutor 分层记忆

底部 AI 问答不再只发送单轮消息，而是使用分层上下文：

- `Base Safety Prompt`：内置安全基座，限定为日语学习助手
- `Tutor Profile Prompt`：账号级可配置的导师名字、风格、输出偏好
- `Learner Snapshot Prompt`：当前课次、掌握度、薄弱项、错题、测验摘要
- `Task Context Prompt`：当前模块教材摘要与最近几轮会话

为了控制 token，用“最近几轮 + 压缩摘要 + 当前任务相关内容”替代整段历史回放。

---

## 四、数据模型

## Important changes or additions to public APIs/interfaces/types

### 4.1 学习相关数据

```ts
interface LearningProgress {
  lessonId: number;
  module: Module;
  masteryPercent: number;
  totalItems?: number;
  lastStudiedAt?: string;
  updatedAt: string;
}
```

```ts
interface MasteryStatus {
  lessonId: number;
  module: Module;
  itemKey: string;
  status: "mastered" | "fuzzy" | "weak" | "new";
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}
```

```ts
interface WrongAnswer {
  lessonId: number;
  module: Module;
  question: string;
  userAnswer?: string;
  correctAnswer: string;
  errorReason?: string;
  status: "mastered" | "weak";
  questionType?: QuizQuestionType;
  sourceType?: QuizSourceType;
  knowledgeKeys?: string[];
  createdAt: string;
}
```

### 4.2 测验题型

```ts
type QuizQuestionType = "multiple_choice" | "fill_blank" | "translation";
type QuizSourceType = "random_scope" | "manual_targets" | "weak_items" | "mixed";
```

```ts
interface QuizResolvedTarget {
  key: string;
  label: string;
  module: Module;
  lessonId: number;
  matchedFrom?: string;
  sourceKinds?: string[];
  excerpt?: string;
}
```

```ts
interface MultipleChoiceQuestion {
  id: number;
  type: "multiple_choice";
  prompt: string;
  options: string[];
  correctIndex: number;
  knowledgeKeys?: string[];
  explanation?: string;
}
```

```ts
interface FillBlankQuestion {
  id: number;
  type: "fill_blank";
  prompt: string;
  answer: string;
  acceptedAnswers?: string[];
  placeholder?: string;
  knowledgeKeys?: string[];
  explanation?: string;
}
```

```ts
interface TranslationQuestion {
  id: number;
  type: "translation";
  prompt: string;
  direction: "zh-to-ja" | "ja-to-zh";
  answer: string;
  acceptedAnswers?: string[];
  placeholder?: string;
  knowledgeKeys?: string[];
  explanation?: string;
}
```

```ts
type QuizQuestion =
  | MultipleChoiceQuestion
  | FillBlankQuestion
  | TranslationQuestion;
```

```ts
interface QuizData {
  title: string;
  lessonId?: number;
  module?: Module;
  sourceType?: QuizSourceType;
  questionType?: QuizQuestionType;
  count?: number;
  resolvedTargets?: Array<{ key: string; label: string }>;
  questions: QuizQuestion[];
}
```

### 4.3 测验会话

```ts
interface QuizResult {
  questionId: number;
  questionType: QuizQuestionType;
  isCorrect: boolean;
  userAnswer: string | number | null;
  correctAnswer: string;
  explanation?: string;
  knowledgeKeys: string[];
}
```

```ts
interface QuizSessionRecord {
  title: string;
  lessonId: number;
  module: Module;
  sourceType: QuizSourceType;
  questionType: QuizQuestionType;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  targetLabels?: string[];
  results: Array<QuizResult & { prompt: string }>;
  createdAt: string;
}
```

---

## 五、Dexie 表结构

当前数据库版本升级到 `v5`，包含：

```ts
learningProgress: "++id, lessonId, module, updatedAt"
masteryStatus: "++id, lessonId, module, status, [lessonId+module+itemKey]"
wrongAnswers: "++id, lessonId, module, status"
studySessions: "++id, date, module"
contentCache: "++id, [lessonId+module], updatedAt"
quizSessions: "++id, lessonId, module, questionType, sourceType, createdAt"
aiConversations: "++id, ownerId, updatedAt, lastMessageAt"
aiMessages: "++id, conversationId, ownerId, role, createdAt"
aiConversationSummaries: "++id, conversationId, ownerId, updatedAt"
aiLongTermMemories: "++id, ownerId, kind, score, updatedAt, lastUsedAt"
```

其中：

- `aiConversations`：对话线程
- `aiMessages`：用户 / 助手消息
- `aiConversationSummaries`：旧消息压缩摘要
- `aiLongTermMemories`：后续沉淀稳定偏好与长期弱项

---

## 六、组卷与答题流程

### 6.1 目标候选池

`buildQuizTargetCandidates()` 会基于当前专题内容构建候选知识点：

- 单词：以单词为单位
- 语法：以语法点为单位
- 课文：以句子为单位（掌握映射回整篇课文）
- 例句：以例句为单位
- 听力：以听力题为单位

### 6.2 目标识别流程

```text
用户输入自然语言目标
→ 构建当前专题候选池
→ 先做本地匹配兜底
→ 调用 AI 目标识别 Prompt
→ 过滤为当前候选池中的合法 key
→ 返回已识别目标
```

### 6.3 组卷流程

```text
选择来源 + 题型 + 题量
→ 获取当前候选池 / 薄弱池 / 已识别目标
→ 调用 AI Quiz Prompt
→ 解析结构化 JSON
→ 修正缺失的 knowledgeKeys
→ 渲染题目 UI
```

### 6.4 提交流程

```text
用户完成答题
→ 本地判题
→ 生成 QuizSubmission
→ 写入 quizSessions
→ 更新 masteryStatus
→ 写入 wrongAnswers（若答错）
→ 重新同步 learningProgress
→ 学习记录页统计更新
```

---

## 七、本地判题规则

### 7.1 选择题

```ts
selectedIndex === correctIndex
```

### 7.2 填空题 / 翻译题

统一使用 `normalizeQuizTextAnswer()` 进行文本规范化：

- `trim()`
- `NFKC` 归一化
- 小写化
- 移除空格
- 移除常见中英文标点

再与：

- `answer`
- `acceptedAnswers[]`

做精确匹配。

---

## 八、页面状态与组件设计

### 8.1 组件

- `ModuleModeTabs`
- `ModuleQuizPanel`
- `StructuredQuiz`
- 现有学习内容组件/页面

### 8.2 关键页面状态

```ts
mode: "study" | "quiz"
sourceType: QuizSourceType
questionType: QuizQuestionType
count: number
targetInput: string
resolvedTargets: QuizResolvedTarget[]
quiz: QuizData | null
feedback: string
error: string
```

### 8.3 学习记录页新增能力

`HistoryStats` 新增：

- `totalQuizSessions`
- `quizAccuracyByType`
- `recentQuizSessions`

并通过 `generateProgressInsight()` 调用 AI 总结统计结果。

---

## 九、Prompt Contract

### 9.1 目标识别 Prompt 输出

```json
{
  "targets": [
    {
      "key": "vocabulary:先生",
      "matchedFrom": "老师"
    }
  ]
}
```

实际实现中 `key` 必须来自当前专题候选池。

### 9.2 组卷 Prompt 输出

```json
{
  "type": "quiz",
  "data": {
    "title": "第5课 单词测验",
    "lessonId": 5,
    "module": "vocabulary",
    "sourceType": "manual_targets",
    "questionType": "multiple_choice",
    "count": 5,
    "questions": [
      {
        "id": 1,
        "type": "multiple_choice",
        "prompt": "「先生」的意思是？",
        "options": ["老师", "学生", "银行", "朋友"],
        "correctIndex": 0,
        "knowledgeKeys": ["先生"],
        "explanation": "先生表示老师。"
      }
    ]
  }
}
```

---

## 十、测试与验收

## Test cases and scenarios

### 10.1 单元测试

当前自动化测试覆盖：

- AI 路由工具解析
- 内容解析
- 进度计算
- 测验候选构建
- 本地目标匹配
- 测验 payload 解析
- 多题型本地判题

### 10.2 端到端验收场景

- 单词页可以在 `学习 / 测验` 之间切换
- 在测验模式中可选 4 种组卷来源
- 指定目标支持中文 / 日文输入
- 系统会先展示已识别目标，再生成题目
- 三类题型都以原生 UI 表单呈现
- 提交后立即展示结果与解析
- 错题、薄弱项、模块进度会同步更新
- 学习记录页能展示测验场次、题型正确率、最近测验
- 学习记录页可生成 AI 学情点评

### 10.3 边界场景

- 指定目标识别失败
- 当前无薄弱项却选择“薄弱项组卷”
- AI 返回题量不足
- AI 返回不合法 JSON
- 切换课次后旧测验题目失效
- 重新生成题目后旧答案被清空

---

## 十一、兼容性与默认策略

## Explicit assumptions and defaults chosen

- 正式测验入口固定在专题页内部
- 底部 AI 输入栏继续保留自由问答职责
- 听力首版采用文本 / TTS 辅助，不引入独立音频资源管理
- 翻译题首版采用规则匹配，不做开放式语义评分
- 课文题目以句子粒度出题，但掌握状态回写到整篇课文
- 若 AI 未返回 `knowledgeKeys`，系统使用当前主题源池做兜底映射
