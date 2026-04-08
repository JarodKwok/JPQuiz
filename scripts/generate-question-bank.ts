/**
 * 题库预生成脚本
 *
 * 从 builtin-content 读取各课内容，调用 AI 批量生成题目，输出为 Markdown 文件。
 *
 * 规则：
 *   - 单词：选择题(2x) + 填空题(1x) + 问答题(1x)，选择题双向覆盖（日→中、中→日）
 *   - 语法/课文/例句：选择题(2x) + 填空题(1x)，无问答题
 *
 * 用法:
 *   npx tsx scripts/generate-question-bank.ts                          # 全部25课
 *   npx tsx scripts/generate-question-bank.ts --lesson 1               # 仅第1课
 *   npx tsx scripts/generate-question-bank.ts --lesson 1 --module vocabulary
 *   npx tsx scripts/generate-question-bank.ts --lesson 1 --type multiple_choice
 *   npx tsx scripts/generate-question-bank.ts --force                  # 覆盖已有文件
 */

import { BUILTIN_LESSON_CONTENT } from "../src/data/builtin-content";
import type { VocabularyItem, GrammarItem, TextContent, ExamplesContent } from "../src/types/content";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ── 配置 ─────────────────────────────────────────────────────────────────
const API_KEY = process.env.OPENROUTER_API_KEY || "";
const API_BASE = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "z-ai/glm-5";
const MIN_QUESTIONS = 10;
const OUTPUT_DIR = join(process.cwd(), "books", "questions");
const DELAY_MS = 3000; // 请求间隔

type Module = "vocabulary" | "grammar" | "text" | "examples";
type QuestionType = "multiple_choice" | "fill_blank" | "translation";

const MODULE_NAMES: Record<Module, string> = {
  vocabulary: "单词",
  grammar: "语法",
  text: "课文",
  examples: "例句",
};

const TYPE_NAMES: Record<QuestionType, string> = {
  multiple_choice: "选择题",
  fill_blank: "填空题",
  translation: "问答题",
};

// ── 题型规则 ──────────────────────────────────────────────────────────────
// 语法/课文/例句 只出选择题+填空题；单词出全部三种
function getQuestionTypes(module: Module): QuestionType[] {
  if (module === "vocabulary") {
    return ["multiple_choice", "fill_blank", "translation"];
  }
  return ["multiple_choice", "fill_blank"];
}

// 选择题数量 = 知识点 × 2（双向覆盖），其他 = 知识点 × 1
function getQuestionCount(keysLength: number, questionType: QuestionType): number {
  if (questionType === "multiple_choice") {
    return Math.max(keysLength * 2, MIN_QUESTIONS);
  }
  return Math.max(keysLength, MIN_QUESTIONS);
}

// 选择题 max_tokens 需要更大（2倍题量）
function getMaxTokens(questionType: QuestionType, keysLength: number): number {
  if (questionType === "multiple_choice") {
    // ~120 tokens per question, 2x keys
    return Math.max(8192, keysLength * 250);
  }
  return Math.max(4096, keysLength * 130);
}

// ── CLI 参数解析 ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argLesson = getArg("lesson") ? Number(getArg("lesson")) : undefined;
const argModule = getArg("module") as Module | undefined;
const argType = getArg("type") as QuestionType | undefined;
const forceOverwrite = args.includes("--force");

// ── 构建候选知识点摘要 ────────────────────────────────────────────────────
function buildCandidateSummary(lessonId: number, module: Module): string {
  const lesson = BUILTIN_LESSON_CONTENT[lessonId];
  if (!lesson) return "";

  switch (module) {
    case "vocabulary": {
      const items = lesson.vocabulary as VocabularyItem[];
      return items
        .map(
          (item) =>
            `- ${item.word}（${item.reading}）：${item.meaning}${item.kanji ? ` [${item.kanji}]` : ""}`
        )
        .join("\n");
    }
    case "grammar": {
      const items = lesson.grammar as GrammarItem[];
      return items
        .map(
          (item) =>
            `- ${item.id} ${item.name}：${item.meaning}（接续：${item.connection}）`
        )
        .join("\n");
    }
    case "text": {
      const content = lesson.text as TextContent;
      return content.lines
        .map(
          (line, i) =>
            `- 第${i + 1}句：${line.japanese}（${line.translation}）`
        )
        .join("\n");
    }
    case "examples": {
      const content = lesson.examples as ExamplesContent;
      const patterns = content.patterns
        .map((p) => `- [句型] ${p.pattern}：${p.meaning}（例：${p.sampleJapanese}）`)
        .join("\n");
      const examples = content.examples
        .map((e) => `- [例句] ${e.japanese}（${e.translation}）`)
        .join("\n");
      return patterns + "\n" + examples;
    }
  }
}

function buildKnowledgeKeys(lessonId: number, module: Module): string[] {
  const lesson = BUILTIN_LESSON_CONTENT[lessonId];
  if (!lesson) return [];

  switch (module) {
    case "vocabulary":
      return (lesson.vocabulary as VocabularyItem[]).map((i) => i.word);
    case "grammar":
      return (lesson.grammar as GrammarItem[]).map((i) => i.id);
    case "text":
      return (lesson.text as TextContent).lines.map(
        (_, i) => `text:${lessonId}:line:${i}`
      );
    case "examples": {
      const c = lesson.examples as ExamplesContent;
      return [
        ...c.patterns.map((p) => `examples:${lessonId}:pattern:${p.id}`),
        ...c.examples.map((_, i) => `examples:${lessonId}:example:${i}`),
      ];
    }
  }
}

// ── AI 调用 ───────────────────────────────────────────────────────────────
async function callAI(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "HTTP-Referer": "https://jpquiz.app",
      "X-Title": "JPQuiz",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── Prompt ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `你是一个日语 N5 测验出题专家，根据《大家的日语》初级 I 的内容生成高质量练习题。

要求：
1. 题目必须严格基于提供的候选知识点。
2. 每道题必须标注对应的知识点 key。
3. 选择题必须提供 4 个选项，只有一个正确答案。
4. 填空题和问答题必须提供标准答案和可接受的替代答案。
5. 解析简洁明了，用中文。
6. 尽量覆盖所有知识点，避免重复。
7. 按照指定的 Markdown 格式输出，不要输出其他内容。`;

function buildUserPrompt(
  lessonId: number,
  module: Module,
  questionType: QuestionType,
  candidates: string,
  keys: string[],
  count: number
): string {
  const formatGuide =
    questionType === "multiple_choice"
      ? `### {序号}. {题干}
- [x] {正确选项}
- [ ] {错误选项}
- [ ] {错误选项}
- [ ] {错误选项}
**知识点**: {knowledgeKey}
**解析**: {解析文字}`
      : questionType === "fill_blank"
        ? `### {序号}. {题干（用 _____ 表示空位）}
**答案**: {标准答案}
**可接受答案**: {其他可接受答案，逗号分隔，没有则写"无"}
**知识点**: {knowledgeKey}
**解析**: {解析文字}`
        : `### {序号}. {翻译题题干}
**方向**: {ja-to-zh 或 zh-to-ja}
**答案**: {标准答案}
**可接受答案**: {其他可接受答案，逗号分隔，没有则写"无"}
**知识点**: {knowledgeKey}
**解析**: {解析文字}`;

  // 选择题特殊要求：双向覆盖
  const directionHint =
    questionType === "multiple_choice"
      ? `\n\n重要：每个知识点出两道题——一道「日文→中文」（给日文选中文意思），一道「中文→日文」（给中文选日文）。确保双向覆盖所有知识点。`
      : "";

  return `请为《大家的日语》第 ${lessonId} 课的「${MODULE_NAMES[module]}」模块生成 ${count} 道「${TYPE_NAMES[questionType]}」。每个知识点至少出一道题，确保全覆盖。${directionHint}

候选知识点：
${candidates}

知识点 key 列表（题目中的"知识点"字段必须从这里选）：
${keys.join(", ")}

每道题严格使用以下格式（不要添加额外的标题或说明）：

${formatGuide}

---

每道题之间用 --- 分隔。正确选项用 [x] 标记。直接开始输出题目：`;
}

// ── 生成单个文件 ──────────────────────────────────────────────────────────
async function generateFile(
  lessonId: number,
  module: Module,
  questionType: QuestionType
): Promise<boolean> {
  const dir = join(OUTPUT_DIR, `lesson_${String(lessonId).padStart(2, "0")}`);
  const filename = `${module}_${questionType}.md`;
  const filepath = join(dir, filename);

  if (existsSync(filepath) && !forceOverwrite) {
    console.log(`  ⏭ ${filename}（已存在，跳过）`);
    return false;
  }

  const candidates = buildCandidateSummary(lessonId, module);
  const keys = buildKnowledgeKeys(lessonId, module);

  if (!candidates || keys.length === 0) {
    console.log(`  ⚠ ${filename}（无候选知识点，跳过）`);
    return false;
  }

  const count = getQuestionCount(keys.length, questionType);
  const maxTokens = getMaxTokens(questionType, keys.length);

  const userPrompt = buildUserPrompt(
    lessonId,
    module,
    questionType,
    candidates,
    keys,
    count
  );

  try {
    const content = await callAI(SYSTEM_PROMPT, userPrompt, maxTokens);

    const header = `# 第${lessonId}课 · ${MODULE_NAMES[module]} · ${TYPE_NAMES[questionType]}

> 生成时间: ${new Date().toISOString().split("T")[0]} | 模型: ${MODEL} | 共 ${keys.length} 个知识点 | 目标 ${count} 题

---

`;

    mkdirSync(dir, { recursive: true });
    writeFileSync(filepath, header + content.trim() + "\n", "utf-8");
    console.log(`  ✅ ${filename}（${count} 题 / ${content.length} 字符）`);
    return true;
  } catch (err) {
    console.error(
      `  ❌ ${filename}：${err instanceof Error ? err.message : err}`
    );
    return false;
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error(
      "❌ 请设置 OPENROUTER_API_KEY 环境变量：\n" +
        "  export OPENROUTER_API_KEY=sk-or-v1-xxx\n" +
        "  npx tsx scripts/generate-question-bank.ts --lesson 1"
    );
    process.exit(1);
  }

  const lessons = argLesson
    ? [argLesson]
    : Object.keys(BUILTIN_LESSON_CONTENT).map(Number).sort((a, b) => a - b);
  const modules = argModule ? [argModule] : (["vocabulary", "grammar", "text", "examples"] as Module[]);

  // 构建任务列表
  const tasks: Array<{ lessonId: number; module: Module; questionType: QuestionType }> = [];
  for (const lessonId of lessons) {
    for (const module of modules) {
      const types = argType ? [argType] : getQuestionTypes(module);
      for (const questionType of types) {
        tasks.push({ lessonId, module, questionType });
      }
    }
  }

  const total = tasks.length;
  let done = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`\n📝 题库生成`);
  console.log(`   课次: ${lessons.join(", ")}`);
  console.log(`   模块: ${modules.join(", ")}`);
  console.log(`   目标文件数: ${total}`);
  console.log(`   模型: ${MODEL}`);
  console.log(`   规则: 单词(选×2/填×1/问×1) 语法+课文+例句(选×2/填×1)\n`);

  let currentLesson = -1;
  for (const task of tasks) {
    if (task.lessonId !== currentLesson) {
      currentLesson = task.lessonId;
      console.log(`\n=== 第${currentLesson}课 ===`);
    }

    done++;
    process.stdout.write(`  [${done}/${total}] `);

    const ok = await generateFile(task.lessonId, task.module, task.questionType);
    if (ok) {
      generated++;
      // 请求间隔，避免限流
      if (done < total) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ 完成！生成: ${generated}  跳过: ${skipped}  失败: ${failed}`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("💥 致命错误:", err);
  process.exit(1);
});
