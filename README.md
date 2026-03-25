# JPQuiz

一个基于 `Next.js 16` 的日语学习应用，围绕《大家的日语》课次组织内容，支持 AI 生成学习材料、专题内“学习 / 测验”双模式、智能组卷、掌握度追踪和本地学习记录。

## 功能概览

- 课次切换：按第 `1`–`25` 课切换当前学习上下文
- 五个学习模块：`vocabulary`、`grammar`、`text`、`examples`、`listening`
- 双模式专题页：每个专题都支持 `学习` 和 `测验` 两种模式
- AI 内容生成：按课次生成模块内容，并缓存到浏览器本地数据库
- 智能组卷：支持当前范围随机、指定目标、错题/薄弱项、混合强化
- 固定题型：`选择题`、`填空题`、`问答题（翻译）`
- AI 助手：底部输入栏用于答疑、讲解、解释错题
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

这些数据默认只保存在当前浏览器环境中，不会自动同步到云端。
