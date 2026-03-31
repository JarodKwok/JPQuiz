# JPQuiz

一个基于 `Next.js 16` 的日语学习应用，围绕《大家的日语》课次组织内容，支持 AI 生成学习材料、专题内“学习 / 测验”双模式、智能组卷、掌握度追踪和本地学习记录。

## 功能概览

- 课次切换：按第 `1`–`25` 课切换当前学习上下文
- 五个学习模块：`vocabulary`、`grammar`、`text`、`examples`、`listening`
- 双模式专题页：每个专题都支持 `学习` 和 `测验` 两种模式
- 学习内容内置：`1`–`25` 课五个模块都使用固定内置内容，切课无需再依赖 AI
- 智能组卷：支持当前范围随机、指定目标、错题/薄弱项、混合强化
- 固定题型：`选择题`、`填空题`、`问答题（翻译）`
- 测验动态生成：AI 仅用于生成测验题内容，学习内容本身保持稳定
- AI 助手：底部输入栏用于答疑、讲解、解释错题
- AI 分层记忆：底部 Tutor 支持多轮会话、当前课次上下文、学习快照与可配置记忆策略
- 学习追踪：记录掌握度、学习时长、错题、测验结果与 AI 学情总结
- 本地存储：AI 配置与学习数据都保存在浏览器本地，AI 设置会做本地加密

## 技术栈

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Zustand`
- `Dexie` / IndexedDB
- `Vitest`

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：

```bash
http://localhost:3000
```

## 服务启停

现在可以直接用以下短命令管理服务：

- `npm run app:up`：构建并在后台启动预览服务，默认端口 `3006`
- `npm run app:stop`：停止预览服务
- `npm run app:restart`：重建并重启预览服务
- `npm run app:status`：查看预览服务状态
- `npm run app:logs`：查看预览服务日志
- `npm run app:stop-all`：停止所有通过脚本启动的受管服务

如果你想跑后台开发服务：

- `npm run app:dev:up`：后台启动开发服务，默认端口 `3007`
- `npm run app:dev:stop`：停止后台开发服务
- `npm run app:dev:status`：查看后台开发服务状态
- `npm run app:dev:logs`：查看后台开发服务日志

也支持临时改端口，例如：

```bash
JPQUIZ_PORT=3010 npm run app:up
JPQUIZ_PORT=3010 npm run app:stop
```

脚本会把 PID 和日志写到项目下的 `.runtime/` 目录中，方便后续管理。

## AI 配置

在应用的“设置”页面配置 AI Provider：

- `OpenAI / 代理`
- `Kimi`
- `DeepSeek`

需要填写：

- `API Key`
- `Model`
- `Base URL`
- `API 格式`（`Chat Completions` 或 `Responses API`）

默认会为 `OpenAI / 代理` 预填：

- `Model`: `gpt-5.4`
- `Base URL`: `https://gmn.chuangzuoli.com`
- `API 格式`: `Responses API`

点击“保存设置”后，配置会使用浏览器本地加密存储持久化。

除了 Provider 配置，现在也支持基础 Tutor 配置：

- `导师名字`
- `教学风格`
- `输出格式偏好`
- `个性化导师提示词`
- `记忆策略`：最近保留轮数、薄弱点数量、最近错题数量、对话摘要触发轮数、上下文预算等

系统会始终保留一层内置安全基座，限制 AI 聚焦日语学习，并拒绝黄赌毒、政治、宗教、战争、暴力等敏感内容。

更完整的分层设计见：

- `PRD/ai-memory-design.md`

## 可用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
```

## 数据说明

应用使用 IndexedDB 保存以下内容：

- `contentCache`：AI 生成的模块内容缓存
- `masteryStatus`：知识点掌握状态
- `learningProgress`：各模块进度
- `studySessions`：学习时长记录
- `wrongAnswers`：错题记录
- `quizSessions`：测验场次与答题结果
- `aiConversations`：Tutor 对话线程
- `aiMessages`：Tutor 多轮消息
- `aiConversationSummaries`：对话压缩摘要
- `aiLongTermMemories`：长期记忆占位表，供后续智能化扩展

这些数据默认只保存在当前浏览器环境中，不会自动同步到云端。
