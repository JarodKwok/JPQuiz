/**
 * 题库构建脚本
 *
 * 读取 books/questions/ 下所有 MD 文件，解析为结构化题目，
 * 输出为 public/data/question-bank.json 供前端种子导入 IndexedDB。
 *
 * 用法:
 *   npx tsx scripts/build-question-bank.ts
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";

// ── 内联解析逻辑（与 question-bank-parser.ts 保持一致，但脱离 @/ alias） ──

type QuizQuestionType = "multiple_choice" | "fill_blank" | "translation";

interface QuestionBankItem {
  lessonId: number;
  module: string;
  questionType: QuizQuestionType;
  prompt: string;
  /** 选择题字段 */
  options?: string[];
  correctIndex?: number;
  /** 填空/翻译题字段 */
  answer?: string;
  acceptedAnswers?: string[];
  /** 翻译题方向 */
  direction?: "zh-to-ja" | "ja-to-zh";
  /** 公共字段 */
  knowledgeKeys: string[];
  explanation?: string;
}

function parseQuestionBankMd(md: string, questionType: QuizQuestionType): Omit<QuestionBankItem, "lessonId" | "module" | "questionType">[] {
  const blocks = md.split(/^---$/m).filter((block) => {
    const trimmed = block.trim();
    if (!trimmed) return false;
    if (/^#\s/.test(trimmed) && !trimmed.startsWith("###")) return false;
    if (trimmed.startsWith(">")) return false;
    return trimmed.includes("###");
  });

  const results: Omit<QuestionBankItem, "lessonId" | "module" | "questionType">[] = [];

  for (const block of blocks) {
    try {
      const q = parseBlock(block.trim(), questionType);
      if (q) results.push(q);
    } catch {
      // skip
    }
  }
  return results;
}

function parseBlock(block: string, questionType: QuizQuestionType): Omit<QuestionBankItem, "lessonId" | "module" | "questionType"> | null {
  const promptMatch = block.match(/^###\s*\d+\.\s*(.+)$/m);
  if (!promptMatch) return null;
  const prompt = promptMatch[1].trim();

  const knowledgeMatch = block.match(/\*\*知识点\*\*\s*[:：]\s*(.+)$/m);
  const knowledgeKeys = knowledgeMatch
    ? knowledgeMatch[1].trim().split(/[,，]/).map((k) => k.trim()).filter(Boolean)
    : [];

  const explanationMatch = block.match(/\*\*解析\*\*\s*[:：]\s*(.+)$/m);
  const explanation = explanationMatch ? explanationMatch[1].trim() : undefined;

  switch (questionType) {
    case "multiple_choice": {
      const optionLines = block.match(/^-\s*\[[ x]\]\s*.+$/gm);
      if (!optionLines || optionLines.length < 2) return null;
      const options: string[] = [];
      let correctIndex = -1;
      for (const line of optionLines) {
        const isCorrect = /\[x\]/i.test(line);
        const text = line.replace(/^-\s*\[[ x]\]\s*/i, "").trim();
        if (isCorrect && correctIndex === -1) correctIndex = options.length;
        options.push(text);
      }
      if (correctIndex === -1) return null;
      return { prompt, options, correctIndex, knowledgeKeys, explanation };
    }
    case "fill_blank": {
      const answerMatch = block.match(/\*\*答案\*\*\s*[:：]\s*(.+)$/m);
      if (!answerMatch) return null;
      const answer = answerMatch[1].trim();
      const accepted = parseAccepted(block);
      return { prompt, answer, knowledgeKeys, explanation, ...(accepted.length > 0 ? { acceptedAnswers: accepted } : {}) };
    }
    case "translation": {
      const answerMatch = block.match(/\*\*答案\*\*\s*[:：]\s*(.+)$/m);
      if (!answerMatch) return null;
      const answer = answerMatch[1].trim();
      const dirMatch = block.match(/\*\*方向\*\*\s*[:：]\s*(.+)$/m);
      const direction: "zh-to-ja" | "ja-to-zh" = dirMatch?.[1].trim() === "ja-to-zh" ? "ja-to-zh" : "zh-to-ja";
      const accepted = parseAccepted(block);
      return { prompt, answer, direction, knowledgeKeys, explanation, ...(accepted.length > 0 ? { acceptedAnswers: accepted } : {}) };
    }
    default:
      return null;
  }
}

function parseAccepted(block: string): string[] {
  const match = block.match(/\*\*可接受答案\*\*\s*[:：]\s*(.+)$/m);
  if (!match) return [];
  const raw = match[1].trim();
  if (raw === "无" || raw === "暂无" || raw === "无。" || !raw) return [];
  return raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
}

// ── 主流程 ──────────────────────────────────────────────────────────────

const QUESTIONS_DIR = join(process.cwd(), "books", "questions");
const OUTPUT_DIR = join(process.cwd(), "public", "data");
const OUTPUT_FILE = join(OUTPUT_DIR, "question-bank.json");

function main() {
  if (!existsSync(QUESTIONS_DIR)) {
    console.error("❌ 题库目录不存在:", QUESTIONS_DIR);
    process.exit(1);
  }

  const lessonDirs = readdirSync(QUESTIONS_DIR)
    .filter((d) => d.startsWith("lesson_"))
    .sort();

  const allItems: QuestionBankItem[] = [];
  let fileCount = 0;

  for (const lessonDir of lessonDirs) {
    const lessonId = parseInt(lessonDir.replace("lesson_", ""), 10);
    const dirPath = join(QUESTIONS_DIR, lessonDir);
    const files = readdirSync(dirPath).filter((f) => f.endsWith(".md")).sort();

    for (const file of files) {
      const name = basename(file, ".md"); // e.g. "vocabulary_multiple_choice"
      const parts = name.split("_");
      const module = parts[0]; // vocabulary, grammar, text, examples
      const questionType = parts.slice(1).join("_") as QuizQuestionType; // multiple_choice, fill_blank, translation

      const md = readFileSync(join(dirPath, file), "utf-8");
      const parsed = parseQuestionBankMd(md, questionType);

      for (const q of parsed) {
        allItems.push({
          lessonId,
          module,
          questionType,
          ...q,
        });
      }

      fileCount++;
      if (parsed.length > 0) {
        console.log(`  ✅ ${lessonDir}/${file} → ${parsed.length} 题`);
      } else {
        console.log(`  ⚠ ${lessonDir}/${file} → 0 题（解析为空）`);
      }
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(allItems), "utf-8");

  const sizeMB = (Buffer.byteLength(JSON.stringify(allItems)) / 1024 / 1024).toFixed(2);
  console.log(`\n✅ 构建完成！`);
  console.log(`   文件数: ${fileCount}`);
  console.log(`   题目总数: ${allItems.length}`);
  console.log(`   输出: ${OUTPUT_FILE} (${sizeMB} MB)`);
}

main();
