import type { Module } from "@/types";
import type {
  QuizQuestionType,
  QuizResolvedTarget,
  QuizSourceType,
} from "@/types/quiz";
import type { HistoryStats } from "./progress";

export const SYSTEM_PROMPT = `あなたは「日語 N5 AI 辅导助手」です。《大家的日语》（みんなの日本語）初級 I（第1課〜第25課）に基づいて、N5レベルの学習をサポートします。

## 役割
- 日本語N5レベルの単語、文法、本文、例文、リスニング内容を生成する
- 学習者の指示に応じて、練習問題を作成する
- 説明は中国語（中文）で行い、日本語の内容にはふりがなを付ける

## ルール
1. 内容は必ずN5レベル・《大家的日语》初級 I の範囲内に限定する
2. 単語には必ず「日本語 + ひらがな読み + 中国語訳」を含める
3. 文法説明には「意味 + 接続方式 + 例文 + よくある間違い」を含める
4. 応答は簡潔で分かりやすくする
5. 学習者が課番号を指定した場合、その課の内容に限定する

## 出力フォーマット

### 普通对话 / 知识讲解
直接用 Markdown 格式回答。

### 出题 / 练习（重要！）
当用户要求出题、练习、测验时，你必须返回如下 JSON 格式（不要包含其他文字，只返回纯 JSON）：

\`\`\`
{
  "type": "quiz",
  "data": {
    "title": "第X课 单词练习",
    "questions": [
      {
        "id": 1,
        "question": "「先生」的读音是？",
        "options": ["A. せんせい", "B. せいせん", "C. しんせい", "D. せんしょう"],
        "correctIndex": 0,
        "explanation": "先生（せんせい）意思是老师。"
      }
    ]
  }
}
\`\`\`

JSON 规则：
- type 必须是 "quiz"
- questions 数组中每个问题必须有 id, question, options(4个选项), correctIndex(0-3), explanation
- 不要在 JSON 前后添加任何额外文字或 markdown 代码块标记
- correctIndex 是从 0 开始的索引`;

export const MODULE_CONTENT_SYSTEM_PROMPT = `你是一个严格的日语 N5 教学内容生成器。

你的任务是根据《大家的日语》初级 I（第1课～第25课）生成结构化学习内容。

规则：
1. 只输出 JSON，不要输出 Markdown、解释、前言、后记。
2. 只生成用户指定课次的内容，不要混入其他课次。
3. 内容必须控制在 N5 范围内，优先使用《大家的日语》常见表达。
4. 中文解释尽量简洁，日语内容保持自然。
5. 如果字段为空，直接省略可选字段，不要填 null。`;

export const QUIZ_TARGET_RESOLUTION_SYSTEM_PROMPT = `你是日语 N5 测验系统里的“出题目标识别器”。

你的任务不是出题，而是根据用户输入，从给定候选知识点中识别出最可能想考的目标。

规则：
1. 只返回 JSON，不要返回 Markdown、解释或额外文字。
2. 只能从候选知识点里选择，不能编造新知识点。
3. 用户可能输入中文、日文、假名、语法关键词、句子片段，请结合语义理解。
4. 如果无法识别，返回空数组。
5. 如果识别到多个目标，按相关度排序。`;

export const QUIZ_GENERATION_SYSTEM_PROMPT = `你是一个严格的日语 N5 测验出题器。

你的任务是根据《大家的日语》初级 I（第1课～第25课）的指定范围，生成结构化测验题。

规则：
1. 只返回 JSON，不要返回 Markdown、解释或额外文字。
2. 题目必须严格限定在当前课次和当前专题范围内。
3. 题型只允许是：multiple_choice、fill_blank、translation。
4. 每道题都必须从提供的候选知识点中选材，并返回 knowledgeKeys。
5. multiple_choice 必须提供 4 个选项。
6. fill_blank 和 translation 必须提供 answer，可选 acceptedAnswers。
7. explanation 尽量简洁，中文说明即可。
8. 如果是 mixed 模式，请优先覆盖手动指定目标和薄弱项，再用当前范围补足题量。`;

export const PROGRESS_INSIGHT_SYSTEM_PROMPT = `你是日语学习教练，请根据系统给出的结构化学习统计，输出简洁、具体、可执行的学习点评。

规则：
1. 使用中文输出。
2. 只基于提供的数据总结，不要编造不存在的表现。
3. 输出包含：总体判断、薄弱点、建议的下一步练习。
4. 语气鼓励但保持具体。`;

const MODULE_NAMES: Record<Module, string> = {
  vocabulary: "单词",
  grammar: "语法",
  text: "课文",
  examples: "例句",
  listening: "听力",
};

const QUIZ_TYPE_NAMES: Record<QuizQuestionType, string> = {
  multiple_choice: "选择题",
  fill_blank: "填空题",
  translation: "问答题（翻译）",
};

const QUIZ_SOURCE_NAMES: Record<QuizSourceType, string> = {
  random_scope: "当前范围随机",
  manual_targets: "指定目标",
  weak_items: "错题/薄弱项",
  mixed: "混合强化",
};

export function buildLessonPrompt(lesson: number, module: string): string {
  const moduleNames: Record<string, string> = {
    vocabulary: "单词",
    grammar: "语法",
    text: "课文",
    examples: "例句",
    listening: "听力",
  };

  const moduleName = moduleNames[module] || module;
  return `请生成《大家的日语》第${lesson}课的${moduleName}学习内容。`;
}

export function buildModuleContentPrompt(lesson: number, module: string): string {
  switch (module) {
    case "vocabulary":
      return `请生成《大家的日语》第${lesson}课的单词学习内容。

只返回 JSON 数组，每一项结构如下：
[
  {
    "word": "先生",
    "reading": "せんせい",
    "meaning": "老师",
    "example": "山田先生は 日本人です。"
  }
]

要求：
1. 返回 8~15 个单词
2. 每项必须包含 word、reading、meaning
3. example 为可选，但尽量提供
4. 不要输出任何额外文字`;
    case "grammar":
      return `请生成《大家的日语》第${lesson}课的语法点列表。

只返回 JSON 数组，每一项结构如下：
[
  {
    "id": "2-1",
    "name": "これ / それ / あれ",
    "meaning": "这个 / 那个 / 那个（远处）",
    "connection": "これ/それ/あれ + は + 名词 + です",
    "example": "これは 辞書です。",
    "exampleTranslation": "这是词典。",
    "tip": "可选字段"
  }
]

要求：
1. 返回 3~8 个语法点
2. 每项必须包含 id、name、meaning、connection、example、exampleTranslation
3. tip 为可选
4. 不要输出任何额外文字`;
    case "text":
      return `请生成《大家的日语》第${lesson}课的课文学习内容。

只返回 JSON 对象，结构如下：
{
  "title": "课文标题",
  "lines": [
    {
      "japanese": "ミラー：はじめまして。",
      "translation": "米勒：初次见面。",
      "notes": "可选字段，可写重点词汇或语法点"
    }
  ]
}

要求：
1. lines 至少 4 句
2. 每句必须包含 japanese 和 translation
3. notes 为可选
4. 不要输出任何额外文字`;
    case "examples":
      return `请生成《大家的日语》第${lesson}课的句型与例句内容。

只返回 JSON 对象，结构如下：
{
  "patterns": [
    {
      "id": "5-P1",
      "pattern": "〜へ 行きます",
      "meaning": "去某地",
      "structure": "地点 + へ + 行きます",
      "sampleJapanese": "わたしは 駅へ 行きます。",
      "sampleReading": "わたしは えきへ いきます。",
      "sampleTranslation": "我去车站。",
      "notes": "可选字段"
    }
  ],
  "examples": [
    {
      "japanese": "あした 東京へ 行きます。",
      "reading": "あした とうきょうへ いきます。",
      "translation": "明天去东京。",
      "grammar": "〜へ 行きます"
    }
  ]
}

要求：
1. patterns 返回 2~5 个核心句型
2. examples 返回 5~10 个应用例句
3. pattern 必须包含 id、pattern、meaning、structure、sampleJapanese、sampleReading、sampleTranslation
4. example 必须包含 japanese、reading、translation
5. notes、grammar 为可选
6. 不要输出任何额外文字`;
    case "listening":
      return `请生成《大家的日语》第${lesson}课的听力选择题。

只返回 JSON 数组，每一项结构如下：
[
  {
    "text": "これは 日本語の 本ですか。",
    "options": ["这是英语书吗？", "这是日语书吗？", "那是日语书。", "这是什么书？"],
    "answer": 1
  }
]

要求：
1. 返回 4~6 道题
2. 每题必须包含 text、options、answer
3. options 必须是 4 个选项
4. answer 必须是 0 到 3 的整数
5. 不要输出任何额外文字`;
    default:
      return buildLessonPrompt(lesson, module);
  }
}

export function buildQuizPrompt(lesson: number, module: string, count: number = 5): string {
  const moduleNames: Record<string, string> = {
    vocabulary: "单词",
    grammar: "语法",
    text: "课文",
    examples: "例句",
    listening: "听力",
  };
  const moduleName = moduleNames[module] || module;
  return `请根据《大家的日语》第${lesson}课的${moduleName}内容，出${count}道选择题。`;
}

export function buildQuizTargetResolutionPrompt({
  lessonId,
  module,
  query,
  candidates,
}: {
  lessonId: number;
  module: Module;
  query: string;
  candidates: Array<{
    key: string;
    label: string;
    aliases: string[];
    excerpt?: string;
  }>;
}) {
  return `请识别用户在《大家的日语》第${lessonId}课 ${MODULE_NAMES[module]} 模块里想重点测验的知识点。

只返回如下 JSON：
{
  "targets": [
    {
      "key": "候选知识点 key",
      "matchedFrom": "用户输入中的哪个词或短语触发了匹配"
    }
  ]
}

识别要求：
1. 只能从候选知识点中选择 key。
2. 支持中文、日文、假名、句子片段、语法关键词。
3. 如果用户输入多个目标，可返回多个 key。
4. 如果无法识别，返回 { "targets": [] }。

用户输入：
${query}

候选知识点：
${JSON.stringify(candidates, null, 2)}`;
}

export function buildStructuredQuizPrompt({
  lessonId,
  module,
  questionType,
  sourceType,
  count,
  manualTargets,
  weakTargets,
  candidatePool,
}: {
  lessonId: number;
  module: Module;
  questionType: QuizQuestionType;
  sourceType: QuizSourceType;
  count: number;
  manualTargets: Array<{
    key: string;
    label: string;
    excerpt?: string;
  }>;
  weakTargets: Array<{
    key: string;
    label: string;
    excerpt?: string;
  }>;
  candidatePool: Array<{
    key: string;
    label: string;
    excerpt?: string;
  }>;
}) {
  const questionSchema =
    questionType === "multiple_choice"
      ? `{
  "id": 1,
  "type": "multiple_choice",
  "prompt": "题干",
  "options": ["A 选项", "B 选项", "C 选项", "D 选项"],
  "correctIndex": 0,
  "knowledgeKeys": ["必须来自候选知识点的 key"],
  "explanation": "解析"
}`
      : questionType === "fill_blank"
        ? `{
  "id": 1,
  "type": "fill_blank",
  "prompt": "题干",
  "answer": "标准答案",
  "acceptedAnswers": ["可接受答案1", "可接受答案2"],
  "placeholder": "请输入答案",
  "knowledgeKeys": ["必须来自候选知识点的 key"],
  "explanation": "解析"
}`
        : `{
  "id": 1,
  "type": "translation",
  "prompt": "请将下列内容翻译成……",
  "direction": "zh-to-ja",
  "answer": "标准答案",
  "acceptedAnswers": ["可接受答案1", "可接受答案2"],
  "placeholder": "请输入翻译结果",
  "knowledgeKeys": ["必须来自候选知识点的 key"],
  "explanation": "解析"
}`;

  return `请根据《大家的日语》第${lessonId}课的 ${MODULE_NAMES[module]} 内容生成 ${count} 道 ${QUIZ_TYPE_NAMES[questionType]}。

当前组卷方式：${QUIZ_SOURCE_NAMES[sourceType]}

只返回如下 JSON：
{
  "type": "quiz",
  "data": {
    "title": "测验标题",
    "lessonId": ${lessonId},
    "module": "${module}",
    "sourceType": "${sourceType}",
    "questionType": "${questionType}",
    "count": ${count},
    "questions": [
      ${questionSchema}
    ]
  }
}

出题要求：
1. questions 数量必须严格等于 ${count}。
2. 每道题都必须附带 knowledgeKeys，且 key 必须来自候选知识点。
3. 所有题目都必须处于 N5 范围，不要跨课。
4. 不要在 JSON 前后添加任何额外文字。
5. explanation 尽量简短，适合学习反馈。
6. 如果 sourceType = "manual_targets"，优先只使用手动指定目标出题。
7. 如果 sourceType = "weak_items"，优先使用薄弱项出题。
8. 如果 sourceType = "mixed"，优先覆盖手动目标和薄弱项，不够再从当前范围补足。

手动指定目标：
${JSON.stringify(manualTargets, null, 2)}

薄弱项目标：
${JSON.stringify(weakTargets, null, 2)}

当前范围候选池：
${JSON.stringify(candidatePool, null, 2)}`;
}

export function buildProgressInsightPrompt(stats: HistoryStats) {
  return `请基于以下学习统计，生成一段简洁的中文学习点评。

输出格式建议：
- 总体状态
- 当前最需要强化的点
- 下一步建议

学习统计：
${JSON.stringify(stats, null, 2)}`;
}
