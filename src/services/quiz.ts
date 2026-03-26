"use client";

import type { Module } from "@/types";
import type { ModuleContent } from "@/types/content";
import type {
  FillBlankQuestion,
  QuizData,
  QuizDraftAnswer,
  QuizQuestion,
  QuizQuestionType,
  QuizResolvedTarget,
  QuizSessionQuestionRecord,
  QuizSourceType,
  QuizSubmission,
  QuizResult,
  TranslationQuestion,
} from "@/types/quiz";
import { db } from "./db";
import { streamAIText } from "./ai/client";
import { getMasteryMap, saveMastery } from "./mastery";
import { syncLearningProgress } from "./progress";
import {
  buildQuizTargetResolutionPrompt,
  buildStructuredQuizPrompt,
  QUIZ_GENERATION_SYSTEM_PROMPT,
  QUIZ_TARGET_RESOLUTION_SYSTEM_PROMPT,
} from "./prompts";
import { saveWrongAnswer } from "./wrongAnswers";

interface QuizTargetCandidate extends QuizResolvedTarget {
  masteryKey: string;
  aliases: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isModule(value: unknown): value is Module {
  return (
    value === "vocabulary" ||
    value === "grammar" ||
    value === "text" ||
    value === "examples" ||
    value === "listening"
  );
}

function isQuizQuestionType(value: unknown): value is QuizQuestionType {
  return (
    value === "multiple_choice" ||
    value === "fill_blank" ||
    value === "translation"
  );
}

function isQuizSourceType(value: unknown): value is QuizSourceType {
  return (
    value === "random_scope" ||
    value === "manual_targets" ||
    value === "weak_items" ||
    value === "mixed"
  );
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean))
  ) as string[];
}

function extractJsonValue(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const codeBlockMatch = trimmed.match(codeBlockRegex);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  const firstBraceIndex = trimmed.search(/[\[{]/);
  if (firstBraceIndex !== -1) {
    return JSON.parse(trimmed.slice(firstBraceIndex));
  }

  throw new Error("AI 返回内容不是有效 JSON。");
}

export function normalizeQuizTextAnswer(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。．\.]/g, "")
    .replace(/[、，,]/g, "")
    .replace(/[：:]/g, "");
}

function getOptionText(question: QuizQuestion, index: number) {
  if (question.type !== "multiple_choice") return "";
  return question.options[index] || "";
}

function getCorrectAnswerText(question: QuizQuestion) {
  if (question.type === "multiple_choice") {
    return getOptionText(question, question.correctIndex);
  }
  return question.answer;
}

function serializeUserAnswer(question: QuizQuestion, value: QuizDraftAnswer) {
  if (question.type === "multiple_choice") {
    return typeof value === "number" ? getOptionText(question, value) : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

function toResolvedTarget(candidate: QuizTargetCandidate): QuizResolvedTarget {
  return {
    key: candidate.key,
    label: candidate.label,
    module: candidate.module,
    lessonId: candidate.lessonId,
    matchedFrom: candidate.matchedFrom,
    sourceKinds: candidate.sourceKinds,
    excerpt: candidate.excerpt,
  };
}

export function buildQuizTargetCandidates<M extends Module>(
  lessonId: number,
  module: M,
  data: ModuleContent<M>
): QuizTargetCandidate[] {
  switch (module) {
    case "vocabulary":
      return (data as ModuleContent<"vocabulary">).map((item) => ({
        key: item.word,
        masteryKey: item.word,
        label: `${item.word}（${item.reading}）· ${item.meaning}`,
        module,
        lessonId,
        excerpt: item.example,
        aliases: uniqueStrings([
          item.word,
          item.reading,
          item.meaning,
          item.example,
        ]),
      })) as QuizTargetCandidate[];
    case "grammar":
      return (data as ModuleContent<"grammar">).map((item) => ({
        key: item.id,
        masteryKey: item.id,
        label: `${item.id} · ${item.name}`,
        module,
        lessonId,
        excerpt: item.meaning,
        aliases: uniqueStrings([
          item.id,
          item.name,
          item.meaning,
          item.connection,
          item.example,
          item.exampleTranslation,
          item.tip,
        ]),
      })) as QuizTargetCandidate[];
    case "text":
      return (data as ModuleContent<"text">).lines.map((line, index) => ({
        key: `text:${lessonId}:line:${index}`,
        masteryKey: `text:${lessonId}`,
        label: `第 ${index + 1} 句 · ${line.japanese}`,
        module,
        lessonId,
        excerpt: line.translation,
        aliases: uniqueStrings([line.japanese, line.translation, line.notes]),
      })) as QuizTargetCandidate[];
    case "examples":
      return [
        ...(data as ModuleContent<"examples">).patterns.map((item) => ({
          key: `examples:${lessonId}:pattern:${item.id}`,
          masteryKey: item.id,
          label: `${item.pattern} · ${item.meaning}`,
          module,
          lessonId,
          excerpt: item.sampleTranslation,
          aliases: uniqueStrings([
            item.id,
            item.pattern,
            item.meaning,
            item.structure,
            item.sampleJapanese,
            item.sampleReading,
            item.sampleTranslation,
            item.notes,
          ]),
        })),
        ...(data as ModuleContent<"examples">).examples.map((item, index) => ({
          key: `examples:${lessonId}:example:${index}`,
          masteryKey: item.japanese,
          label: item.japanese,
          module,
          lessonId,
          excerpt: item.translation,
          aliases: uniqueStrings([
            item.japanese,
            item.reading,
            item.translation,
            item.grammar,
          ]),
        })),
      ] as QuizTargetCandidate[];
    case "listening":
      return (data as ModuleContent<"listening">).map((item, index) => ({
        key: `listening:${lessonId}:${index}:${item.text}`,
        masteryKey: `listening:${lessonId}:${index}:${item.text}`,
        label: `Q${index + 1} · ${item.text}`,
        module,
        lessonId,
        excerpt: item.options.join(" / "),
        aliases: uniqueStrings([item.text, ...item.options]),
      })) as QuizTargetCandidate[];
    default:
      return [];
  }
}

export function matchQuizTargetsLocally(
  query: string,
  candidates: QuizTargetCandidate[]
) {
  const tokens = uniqueStrings([
    query,
    ...query.split(/[\n,，、；;／/\s]+/),
  ]).map((item) => normalizeQuizTextAnswer(item));

  if (tokens.length === 0) return [];

  const scored = candidates
    .map((candidate) => {
      let score = 0;

      for (const token of tokens) {
        if (!token) continue;

        for (const alias of candidate.aliases) {
          const normalizedAlias = normalizeQuizTextAnswer(alias);
          if (!normalizedAlias) continue;

          if (normalizedAlias === token) {
            score += 10;
            continue;
          }

          if (
            normalizedAlias.includes(token) ||
            token.includes(normalizedAlias)
          ) {
            score += 4;
          }
        }
      }

      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ candidate }) => ({
      ...toResolvedTarget(candidate),
      matchedFrom: query,
      sourceKinds: ["manual"],
    }));

  return scored;
}

function parseResolvedTargetsPayload(
  payload: unknown,
  candidates: QuizTargetCandidate[]
) {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const rawTargets =
    isRecord(payload) && Array.isArray(payload.targets)
      ? payload.targets
      : Array.isArray(payload)
        ? payload
        : [];

  return rawTargets
    .map((target) => {
      if (typeof target === "string") {
        const candidate = candidateMap.get(target);
        if (!candidate) return null;
        return {
          ...toResolvedTarget(candidate),
          matchedFrom: target,
          sourceKinds: ["manual"],
        };
      }

      if (!isRecord(target) || !isNonEmptyString(target.key)) return null;

      const candidate = candidateMap.get(target.key);
      if (!candidate) return null;

      return {
        ...toResolvedTarget(candidate),
        matchedFrom: isNonEmptyString(target.matchedFrom)
          ? target.matchedFrom
          : undefined,
        sourceKinds: ["manual"],
      };
    })
    .filter(Boolean) as QuizResolvedTarget[];
}

export async function resolveQuizTargets<M extends Module>({
  lessonId,
  module,
  data,
  query,
}: {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
  query: string;
}) {
  const candidates = buildQuizTargetCandidates(lessonId, module, data);
  const localMatches = matchQuizTargetsLocally(query, candidates);

  if (!query.trim()) return [];
  if (candidates.length === 0) return [];
  if (localMatches.length > 0) return localMatches;

  try {
    const response = await streamAIText([
      { role: "system", content: QUIZ_TARGET_RESOLUTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildQuizTargetResolutionPrompt({
          lessonId,
          module,
          query,
          candidates: candidates.map((candidate) => ({
            key: candidate.key,
            label: candidate.label,
            aliases: candidate.aliases,
            excerpt: candidate.excerpt,
          })),
        }),
      },
    ]);

    const parsed = parseResolvedTargetsPayload(
      extractJsonValue(response),
      candidates
    );

    if (parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    if (localMatches.length === 0) {
      throw error;
    }
  }

  return localMatches;
}

export async function getQuizTargetPools<M extends Module>({
  lessonId,
  module,
  data,
}: {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
}) {
  const candidates = buildQuizTargetCandidates(lessonId, module, data);
  const weakTargets = await getWeakQuizTargets(lessonId, module, candidates);

  return {
    allTargets: candidates.map(toResolvedTarget),
    weakTargets,
  };
}

async function getWeakQuizTargets(
  lessonId: number,
  module: Module,
  candidates: QuizTargetCandidate[]
) {
  const [masteryStatuses, wrongAnswers] = await Promise.all([
    db.masteryStatus.where({ lessonId, module }).toArray(),
    db.wrongAnswers.where({ lessonId, module }).toArray(),
  ]);

  const masteryMap = new Map(
    masteryStatuses.map((item) => [item.itemKey, item])
  );
  const wrongKeyCount = new Map<string, number>();

  for (const wrongAnswer of wrongAnswers) {
    for (const key of wrongAnswer.knowledgeKeys || []) {
      wrongKeyCount.set(key, (wrongKeyCount.get(key) || 0) + 1);
    }
  }

  const scoredTargets = candidates
    .map((candidate) => {
      let score = 0;
      const sourceKinds: string[] = [];
      const mastery = masteryMap.get(candidate.masteryKey);
      const wrongCount =
        wrongKeyCount.get(candidate.key) ||
        wrongKeyCount.get(candidate.masteryKey) ||
        0;

      if (mastery?.status === "weak") {
        score += 100 + mastery.reviewCount * 4;
        sourceKinds.push("weak");
      } else if (mastery?.status === "fuzzy") {
        score += 70 + mastery.reviewCount * 3;
        sourceKinds.push("fuzzy");
      }

      if (wrongCount > 0) {
        score += wrongCount * 25;
        sourceKinds.push("wrong_answer");
      }

      if (score === 0) return null;

      return {
        ...toResolvedTarget(candidate),
        sourceKinds,
        matchedFrom: sourceKinds.join(" / "),
        score,
      };
    })
    .filter(
      (
        item
      ): item is QuizResolvedTarget & {
        score: number;
        sourceKinds: string[];
        matchedFrom: string;
      } => Boolean(item)
    );

  return scoredTargets
    .sort((left, right) => right.score - left.score)
    .map(({ score, ...target }) => target);
}

function inferQuestionType(value: Record<string, unknown>): QuizQuestionType | null {
  if (
    Array.isArray(value.options) &&
    typeof value.correctIndex === "number"
  ) {
    return "multiple_choice";
  }

  if (isNonEmptyString(value.answer) && isNonEmptyString(value.direction)) {
    return "translation";
  }

  if (isNonEmptyString(value.answer)) {
    return "fill_blank";
  }

  return null;
}

function toKnowledgeKeys(
  value: unknown,
  candidateKeys?: Set<string>
) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isNonEmptyString)
    .map((key) => key.trim())
    .filter((key) => (candidateKeys ? candidateKeys.has(key) : true));
}

function isResolvedTargetLike(
  value: unknown
): value is { key: string; label: string } {
  return (
    isRecord(value) && isNonEmptyString(value.key) && isNonEmptyString(value.label)
  );
}

export function parseQuizPayload(
  payload: unknown,
  fallback?: Partial<QuizData>,
  candidateKeys?: Set<string>
) {
  const rawData =
    isRecord(payload) &&
    payload.type === "quiz" &&
    isRecord(payload.data)
      ? payload.data
      : payload;

  if (!isRecord(rawData) || !Array.isArray(rawData.questions)) {
    throw new Error("AI 返回的测验格式不符合预期。");
  }

  const questions = rawData.questions
    .map((question, index) => {
      if (!isRecord(question)) return null;

      const prompt = isNonEmptyString(question.prompt)
        ? question.prompt
        : isNonEmptyString(question.question)
          ? question.question
          : "";

      if (!prompt) return null;

      const type = isQuizQuestionType(question.type)
        ? question.type
        : inferQuestionType(question);

      if (!type) return null;

      const explanation = isNonEmptyString(question.explanation)
        ? question.explanation
        : undefined;
      const knowledgeKeys = toKnowledgeKeys(question.knowledgeKeys, candidateKeys);
      const id =
        typeof question.id === "number" && Number.isFinite(question.id)
          ? question.id
          : index + 1;

      if (type === "multiple_choice") {
        if (
          !Array.isArray(question.options) ||
          question.options.length < 2 ||
          !question.options.every(isNonEmptyString) ||
          typeof question.correctIndex !== "number"
        ) {
          return null;
        }

        return {
          id,
          type,
          prompt,
          options: question.options.map((option) => option.trim()),
          correctIndex: question.correctIndex,
          explanation,
          knowledgeKeys,
        };
      }

      if (!isNonEmptyString(question.answer)) return null;

      const baseQuestion = {
        id,
        type,
        prompt,
        answer: question.answer.trim(),
        acceptedAnswers: Array.isArray(question.acceptedAnswers)
          ? question.acceptedAnswers.filter(isNonEmptyString).map((item) => item.trim())
          : undefined,
        placeholder: isNonEmptyString(question.placeholder)
          ? question.placeholder
          : undefined,
        explanation,
        knowledgeKeys,
      };

      if (type === "fill_blank") {
        return baseQuestion as FillBlankQuestion;
      }

      const direction =
        question.direction === "ja-to-zh" ? "ja-to-zh" : "zh-to-ja";

      return {
        ...baseQuestion,
        type: "translation",
        direction,
      } as TranslationQuestion;
    })
    .filter(Boolean) as QuizQuestion[];

  if (questions.length === 0) {
    throw new Error("AI 返回的测验题目为空。");
  }

  return {
    title: isNonEmptyString(rawData.title)
      ? rawData.title
      : fallback?.title || "AI 测验",
    lessonId:
      typeof rawData.lessonId === "number"
        ? rawData.lessonId
        : fallback?.lessonId,
    module: isModule(rawData.module) ? rawData.module : fallback?.module,
    sourceType: isQuizSourceType(rawData.sourceType)
      ? rawData.sourceType
      : fallback?.sourceType,
    questionType: isQuizQuestionType(rawData.questionType)
      ? rawData.questionType
      : questions[0]?.type || fallback?.questionType,
    count:
      typeof rawData.count === "number"
        ? rawData.count
        : fallback?.count || questions.length,
    resolvedTargets:
      Array.isArray(rawData.resolvedTargets)
        ? rawData.resolvedTargets
            .filter(isResolvedTargetLike)
            .map((item) => ({
              key: item.key.trim(),
              label: item.label.trim(),
            }))
        : fallback?.resolvedTargets,
    questions,
  } satisfies QuizData;
}

function ensureQuestionKnowledgeKeys(
  question: QuizQuestion,
  index: number,
  primaryTargets: QuizResolvedTarget[],
  fallbackTargets: QuizResolvedTarget[]
) {
  if (question.knowledgeKeys && question.knowledgeKeys.length > 0) {
    return question.knowledgeKeys;
  }

  const pool = primaryTargets.length > 0 ? primaryTargets : fallbackTargets;
  if (pool.length === 0) return [];

  return [pool[index % pool.length].key];
}

export async function generateModuleQuiz<M extends Module>({
  lessonId,
  module,
  data,
  questionType,
  sourceType,
  count,
  resolvedTargets = [],
}: {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
  questionType: QuizQuestionType;
  sourceType: QuizSourceType;
  count: number;
  resolvedTargets?: QuizResolvedTarget[];
}) {
  const candidates = buildQuizTargetCandidates(lessonId, module, data);
  const candidateKeys = new Set(candidates.map((candidate) => candidate.key));
  const allTargets = candidates.map(toResolvedTarget);
  const weakTargets = await getWeakQuizTargets(lessonId, module, candidates);
  const validResolvedTargets = resolvedTargets.filter((target) =>
    candidateKeys.has(target.key)
  );

  if (sourceType === "manual_targets" && validResolvedTargets.length === 0) {
    throw new Error("请先识别并确认至少一个目标知识点。");
  }

  if (sourceType === "weak_items" && weakTargets.length === 0) {
    throw new Error(
      "当前还没有可用于组卷的错题或薄弱项，先学习一会儿再来试试吧。"
    );
  }

  const response = await streamAIText([
    { role: "system", content: QUIZ_GENERATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildStructuredQuizPrompt({
        lessonId,
        module,
        questionType,
        sourceType,
        count,
        manualTargets: validResolvedTargets.map((target) => ({
          key: target.key,
          label: target.label,
          excerpt: target.excerpt,
        })),
        weakTargets: weakTargets.map((target) => ({
          key: target.key,
          label: target.label,
          excerpt: target.excerpt,
        })),
        candidatePool: allTargets.map((target) => ({
          key: target.key,
          label: target.label,
          excerpt: target.excerpt,
        })),
      }),
    },
  ]);

  const fallbackTargets =
    sourceType === "manual_targets"
      ? validResolvedTargets
      : sourceType === "weak_items"
        ? weakTargets
        : validResolvedTargets.length > 0
          ? validResolvedTargets
          : weakTargets.length > 0
            ? weakTargets
            : allTargets;

  const parsed = parseQuizPayload(
    extractJsonValue(response),
    {
      lessonId,
      module,
      sourceType,
      questionType,
      count,
      title: `第 ${lessonId} 課 ${module} 测验`,
      resolvedTargets: validResolvedTargets.map((target) => ({
        key: target.key,
        label: target.label,
      })),
    },
    candidateKeys
  );

  if (parsed.questions.length < count) {
    throw new Error("AI 生成的题量不足，请重试。");
  }

  return {
    ...parsed,
    lessonId,
    module,
    sourceType,
    questionType,
    count,
    resolvedTargets: validResolvedTargets.map((target) => ({
      key: target.key,
      label: target.label,
    })),
    questions: parsed.questions.slice(0, count).map((question, index) => ({
      ...question,
      knowledgeKeys: ensureQuestionKnowledgeKeys(
        question,
        index,
        fallbackTargets,
        allTargets
      ),
    })),
  } satisfies QuizData;
}

function isCorrectFreeTextAnswer(
  userAnswer: string,
  question: FillBlankQuestion | TranslationQuestion
) {
  const normalizedUserAnswer = normalizeQuizTextAnswer(userAnswer);
  const answerPool = uniqueStrings([question.answer, ...(question.acceptedAnswers || [])]);

  return answerPool.some(
    (answer) => normalizeQuizTextAnswer(answer) === normalizedUserAnswer
  );
}

export function gradeQuizSubmission(
  quiz: QuizData,
  answers: Record<number, QuizDraftAnswer>
) {
  const results: QuizResult[] = quiz.questions.map((question) => {
    const userAnswer = answers[question.id] ?? null;

    if (question.type === "multiple_choice") {
      const isCorrect =
        typeof userAnswer === "number" && userAnswer === question.correctIndex;

      return {
        questionId: question.id,
        questionType: question.type,
        isCorrect,
        userAnswer,
        correctAnswer: getCorrectAnswerText(question),
        explanation: question.explanation,
        knowledgeKeys: question.knowledgeKeys || [],
      };
    }

    const textAnswer = typeof userAnswer === "string" ? userAnswer : "";
    const isCorrect = textAnswer
      ? isCorrectFreeTextAnswer(textAnswer, question)
      : false;

    return {
      questionId: question.id,
      questionType: question.type,
      isCorrect,
      userAnswer: textAnswer,
      correctAnswer: getCorrectAnswerText(question),
      explanation: question.explanation,
      knowledgeKeys: question.knowledgeKeys || [],
    };
  });

  const correctCount = results.filter((result) => result.isCorrect).length;

  return {
    quizTitle: quiz.title,
    totalQuestions: quiz.questions.length,
    correctCount,
    accuracy:
      quiz.questions.length > 0
        ? Math.round((correctCount / quiz.questions.length) * 100)
        : 0,
    results,
  } satisfies QuizSubmission;
}

function resolveMasteryKeys(
  knowledgeKeys: string[],
  candidateMap: Map<string, QuizTargetCandidate>,
  module: Module,
  lessonId: number
) {
  const masteryKeys = Array.from(
    new Set(
      knowledgeKeys
        .map((key) => candidateMap.get(key)?.masteryKey || key)
        .filter(Boolean)
    )
  );

  if (masteryKeys.length > 0) {
    return masteryKeys;
  }

  if (module === "text") {
    return [`text:${lessonId}`];
  }

  return [];
}

export async function persistQuizSubmission<M extends Module>({
  lessonId,
  module,
  data,
  quiz,
  submission,
}: {
  lessonId: number;
  module: M;
  data: ModuleContent<M>;
  quiz: QuizData;
  submission: QuizSubmission;
}) {
  const candidates = buildQuizTargetCandidates(lessonId, module, data);
  const candidateMap = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const questionMap = new Map(quiz.questions.map((question) => [question.id, question]));
  const sessionResults: QuizSessionQuestionRecord[] = submission.results.map(
    (result) => ({
      ...result,
      prompt: questionMap.get(result.questionId)?.prompt || "",
    })
  );

  const createdAt = new Date().toISOString();

  await db.quizSessions.add({
    title: quiz.title,
    lessonId,
    module,
    sourceType: quiz.sourceType || "random_scope",
    questionType: quiz.questionType || quiz.questions[0]?.type || "multiple_choice",
    totalQuestions: submission.totalQuestions,
    correctCount: submission.correctCount,
    accuracy: submission.accuracy,
    targetLabels: quiz.resolvedTargets?.map((target) => target.label),
    results: sessionResults,
    createdAt,
  });

  for (const result of submission.results) {
    const question = questionMap.get(result.questionId);
    if (!question) continue;

    const masteryKeys = resolveMasteryKeys(
      result.knowledgeKeys,
      candidateMap,
      module,
      lessonId
    );

    for (const masteryKey of masteryKeys) {
      await saveMastery(
        lessonId,
        module,
        masteryKey,
        result.isCorrect ? "mastered" : "weak"
      );
    }

    if (!result.isCorrect) {
      await saveWrongAnswer({
        lessonId,
        module,
        question: question.prompt,
        userAnswer: serializeUserAnswer(question, result.userAnswer),
        correctAnswer: getCorrectAnswerText(question),
        errorReason: question.explanation,
        questionType: question.type,
        sourceType: quiz.sourceType,
        knowledgeKeys: result.knowledgeKeys,
      });
    }
  }

  const masteryMap = await getMasteryMap(lessonId, module);
  await syncLearningProgress(lessonId, module, data, masteryMap);
}
