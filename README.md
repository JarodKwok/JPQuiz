# JPQuiz

一个基于 `Next.js 16` 的日语学习应用，围绕《大家的日语》课次组织内容，支持 AI 生成学习材料、交互式测验、掌握度追踪和本地学习记录。

## 功能概览

- 课次切换：按第 `1`–`25` 课切换当前学习上下文
- 五个学习模块：`vocabulary`、`grammar`、`text`、`examples`、`listening`
- AI 内容生成：按课次生成模块内容，并缓存到浏览器本地数据库
- AI 助手：底部输入栏可直接让 AI 出题、讲解、生成小测
- 学习追踪：记录掌握度、学习时长、错题与薄弱项
- 本地存储：AI 配置与学习数据都保存在浏览器本地

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

- `OpenAI`
- `Kimi`
- `DeepSeek`

需要填写：

- `API Key`
- `Model`
- `Base URL`
- `API 格式`（`Chat Completions` 或 `Responses API`）

对于 OpenAI 官方接口，建议先使用 `gpt-4.1` 作为默认模型；如果你使用的是兼容代理，再按代理支持情况切换模型与接口格式。

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

这些数据默认只保存在当前浏览器环境中，不会自动同步到云端。
