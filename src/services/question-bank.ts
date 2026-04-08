/**
 * 题库服务
 *
 * 从 IndexedDB 读取预生成题目，秒出；数据库为空时自动从 JSON 种子文件导入。
 */

import type { Module } from "@/types";
import type {
  QuizQuestion,
  QuizQuestionType,
  QuizSourceType,
  QuizData,
} from "@/types/quiz";
import { db, type QuestionBankItem } from "./db";

// ── 种子导入 ─────────────────────────────────────────────────────────────

let seedPromise: Promise<void> | null = null;

async function ensureSeeded(): Promise<void> {
  const count = await db.questionBank.count();
  if (count > 0) return;

  // 避免并发重复导入
  if (!seedPromise) {
    seedPromise = doSeed();
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  try {
    const res = await fetch("/data/question-bank.json");
    if (!res.ok) {
      console.warn("[question-bank] 种子文件加载失败:", res.status);
      return;
    }

    const items: Omit<QuestionBankItem, "id">[] = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    // 批量导入
    await db.questionBank.bulkAdd(items as QuestionBankItem[]);
    console.log(`[question-bank] 导入 ${items.length} 道题目到数据库`);
  } catch (err) {
    console.warn("[question-bank] 种子导入失败:", err);
  } finally {
    seedPromise = null;
  }
}

// ── 查询 ─────────────────────────────────────────────────────────────────

async function loadQuestions(
  lessonId: number,
  module: Module,
  questionType: QuizQuestionType
): Promise<QuizQuestion[]> {
  await ensureSeeded();

  const items = await db.questionBank
    .where("[lessonId+module+questionType]")
    .equals([lessonId, module, questionType])
    .toArray();

  return items.map((item, i) => toQuizQuestion(item, i + 1));
}

function toQuizQuestion(item: QuestionBankItem, id: number): QuizQuestion {
  const base = {
    id,
    prompt: item.prompt,
    knowledgeKeys: item.knowledgeKeys,
    explanation: item.explanation,
  };

  switch (item.questionType) {
    case "multiple_choice":
      return {
        ...base,
        type: "multiple_choice",
        options: item.options || [],
        correctIndex: item.correctIndex ?? 0,
      };
    case "fill_blank":
      return {
        ...base,
        type: "fill_blank",
        answer: item.answer || "",
        acceptedAnswers: item.acceptedAnswers,
      };
    case "translation":
      return {
        ...base,
        type: "translation",
        direction: item.direction || "zh-to-ja",
        answer: item.answer || "",
        acceptedAnswers: item.acceptedAnswers,
      };
  }
}

// ── 选题 ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function filterByKeys(questions: QuizQuestion[], keys: string[]): QuizQuestion[] {
  const keySet = new Set(keys);
  return questions.filter(
    (q) => q.knowledgeKeys?.some((k) => keySet.has(k))
  );
}

export async function tryQuestionBank({
  lessonId,
  module,
  questionType,
  sourceType,
  count,
  targetKeys = [],
  weakKeys = [],
}: {
  lessonId: number;
  module: Module;
  questionType: QuizQuestionType;
  sourceType: QuizSourceType;
  count: number;
  targetKeys?: string[];
  weakKeys?: string[];
}): Promise<QuizData | null> {
  const allQuestions = await loadQuestions(lessonId, module, questionType);
  if (allQuestions.length === 0) return null;

  let selected: QuizQuestion[];

  switch (sourceType) {
    case "random_scope": {
      selected = shuffle(allQuestions).slice(0, count);
      break;
    }
    case "manual_targets": {
      if (targetKeys.length === 0) return null;
      const matched = filterByKeys(allQuestions, targetKeys);
      if (matched.length === 0) return null;
      selected = shuffle(matched).slice(0, count);
      break;
    }
    case "weak_items": {
      if (weakKeys.length === 0) return null;
      const matched = filterByKeys(allQuestions, weakKeys);
      if (matched.length === 0) return null;
      selected = shuffle(matched).slice(0, count);
      break;
    }
    case "mixed": {
      const priorityKeys = [...targetKeys, ...weakKeys];
      const priority = priorityKeys.length > 0
        ? filterByKeys(allQuestions, priorityKeys)
        : [];
      const prioritySet = new Set(priority.map((q) => q.id));
      const rest = allQuestions.filter((q) => !prioritySet.has(q.id));
      const combined = [...shuffle(priority), ...shuffle(rest)];
      selected = combined.slice(0, count);
      break;
    }
    default:
      return null;
  }

  if (selected.length === 0) return null;

  const questions = selected.map((q, i) => ({ ...q, id: i + 1 }));

  return {
    title: `第 ${lessonId} 課 ${module} 测验`,
    lessonId,
    module,
    sourceType,
    questionType,
    count: questions.length,
    questions,
  };
}
