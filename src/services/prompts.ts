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
      return `请生成《大家的日语》第${lesson}课的标准例句。

只返回 JSON 数组，每一项结构如下：
[
  {
    "japanese": "わたしは 日本語の 学生です。",
    "reading": "わたしは にほんごの がくせいです。",
    "translation": "我是日语学生。",
    "grammar": "〜は 〜です"
  }
]

要求：
1. 返回 5~10 个例句
2. 每项必须包含 japanese、reading、translation
3. grammar 为可选
4. 不要输出任何额外文字`;
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
