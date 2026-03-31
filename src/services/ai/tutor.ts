"use client";

import type { AIMessage, AISettings, Module } from "@/types";
import type {
  ExamplesContent,
  GrammarItem,
  ListeningItem,
  TextContent,
  VocabularyItem,
} from "@/types/content";
import { db } from "@/services/db";
import { getBuiltinModuleContent } from "@/data/builtin-content";
import { getTodayStudyMinutes, getLessonProgressSummary } from "@/services/progress";
import { getWeakItems } from "@/services/mastery";
import { listWrongAnswersByScope } from "@/services/wrongAnswers";
import { loadSecureAISettings } from "@/services/secure-settings";
import { normalizeAISettings } from "@/services/ai/settings";
import { streamAIText } from "@/services/ai/client";
import {
  getConversationContext,
  listConversationMessages,
  listRelevantLongTermMemories,
  upsertConversationSummary,
} from "@/services/ai/memory";

const BASE_TUTOR_SAFETY_PROMPT = `你是一个专注于《大家的日语》初级 I 与日语 N5 学习的 AI 辅导助手。

硬性边界：
1. 你的主要职责是帮助学习者理解和练习日语，不提供与学习无关的泛化聊天服务。
2. 遇到黄赌毒、政治、宗教、战争、暴力、违法、自残、仇恨、极端主义等敏感或危险主题时，必须拒绝继续展开，也不要以“词汇学习”“翻译”“例句教学”等方式变相提供帮助。
3. 若学习者请求明显偏离日语学习主题，请简短拒绝，并把话题拉回课次内容、词汇、语法、课文、例句、听力、复习建议。
4. 不编造教材范围外的结论；如信息不足，要明确说明并基于当前课次内容给出最稳妥的回答。`;

const TUTOR_RESPONSE_STYLE_PROMPT = `篇幅与粒度控制规则：
1. 严格按照学习者要求的粒度回答，不要自动补充更详细的拓展内容。
2. 如果学习者说“只要词汇”“简单列表”“筛选一下”“只列出来”“不要展开”，默认只给最短可用结果。
3. 对列表型请求，优先返回短列表或紧凑表格；除非学习者明确要求，否则不要给每个词条逐项详解、例句、易错点。
4. 如果学习者是在上一轮结果上追加字段，例如“加上中文意思”“再加动词类别”，应尽量保留原结构，只补充新增字段，不要整份答案重写成更长讲解。
5. 默认先短答；只有学习者明确要求“详细讲解”“逐个分析”“展开说明”时，才进入长回答。
6. 如果需要输出表格，请使用标准 Markdown 表格语法，而不是用空格手动对齐。`;

function truncate(text: string, maxLength: number) {
  const condensed = text.replace(/\s+/g, " ").trim();
  return condensed.length > maxLength
    ? `${condensed.slice(0, maxLength)}...`
    : condensed;
}

function formatVocabularyContext(
  items: VocabularyItem[],
  limit: number
) {
  return items
    .slice(0, limit)
    .map((item) => {
      const kanji = item.kanji ? ` / ${item.kanji}` : "";
      return `- ${item.word}${kanji} (${item.reading})：${item.meaning}`;
    })
    .join("\n");
}

function formatGrammarContext(items: GrammarItem[], limit: number) {
  return items
    .slice(0, limit)
    .map(
      (item) =>
        `- ${item.id} ${item.name}：${item.meaning}；接续：${item.connection}`
    )
    .join("\n");
}

function formatTextContext(content: TextContent, limit: number) {
  return content.lines
    .slice(0, limit)
    .map(
      (item, index) =>
        `- 第${index + 1}句：${item.japanese}｜${item.translation}`
    )
    .join("\n");
}

function formatExamplesContext(content: ExamplesContent, limit: number) {
  const patternLimit = Math.max(1, Math.ceil(limit / 2));
  const exampleLimit = Math.max(1, limit - patternLimit);
  const patterns = content.patterns
    .slice(0, patternLimit)
    .map((item) => `- 句型 ${item.pattern}：${item.meaning}`)
    .join("\n");
  const examples = content.examples
    .slice(0, exampleLimit)
    .map((item) => `- 例句 ${item.japanese}｜${item.translation}`)
    .join("\n");

  return [patterns, examples].filter(Boolean).join("\n");
}

function formatListeningContext(items: ListeningItem[], limit: number) {
  return items
    .slice(0, limit)
    .map((item, index) => `- Q${index + 1}：${item.text}`)
    .join("\n");
}

function buildModuleContextText(
  lessonId: number,
  module: Module,
  itemLimit: number
) {
  const content = getBuiltinModuleContent(lessonId, module);
  if (!content) return "";

  switch (module) {
    case "vocabulary":
      return formatVocabularyContext(content as VocabularyItem[], itemLimit);
    case "grammar":
      return formatGrammarContext(content as GrammarItem[], itemLimit);
    case "text":
      return formatTextContext(content as TextContent, itemLimit);
    case "examples":
      return formatExamplesContext(content as ExamplesContent, itemLimit);
    case "listening":
      return formatListeningContext(content as ListeningItem[], itemLimit);
    default:
      return "";
  }
}

function buildTeachingStyleText(settings: AISettings["tutor"]) {
  const styleText =
    settings.teachingStyle === "concise"
      ? "回答尽量短，先给最关键结论，再补必要解释。"
      : settings.teachingStyle === "coach"
        ? "回答要像陪练教练，指出薄弱点并给下一步练习建议。"
        : "回答尽量结构化，优先用分点或表格帮助学习者理解。";

  const formatText =
    settings.answerFormatPreference === "bullet-first"
      ? "默认优先使用要点列表。"
      : settings.answerFormatPreference === "mixed"
        ? "根据问题内容在表格和列表之间灵活切换。"
        : "涉及对比、归纳、清单时优先使用表格。";

  return `${styleText}\n${formatText}`;
}

async function buildLearnerSnapshotText(
  lessonId: number,
  module: Module,
  settings: AISettings["tutor"]
) {
  const [lessonProgress, todayMinutes, weakItems, wrongAnswers, recentQuizSessions] =
    await Promise.all([
      getLessonProgressSummary(lessonId),
      getTodayStudyMinutes(),
      getWeakItems(),
      listWrongAnswersByScope(lessonId, module),
      db.quizSessions
        .where({ lessonId, module })
        .toArray()
        .then((items) =>
          items.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 2)
        ),
    ]);

  const weakItemsText = weakItems
    .filter((item) => item.lessonId === lessonId)
    .slice(0, settings.memoryPolicy.weakItemsLimit)
    .map(
      (item) =>
        `- ${item.module} / ${item.itemKey} / ${item.status} / 复习${item.reviewCount}次`
    )
    .join("\n");

  const wrongAnswersText = wrongAnswers
    .slice(0, settings.memoryPolicy.recentWrongAnswersLimit)
    .map(
      (item) =>
        `- 题目：${truncate(item.question, 48)}｜正确答案：${item.correctAnswer}`
    )
    .join("\n");

  const recentQuizText = recentQuizSessions
    .map(
      (item) =>
        `- ${item.title}｜${item.questionType}｜正确率 ${item.accuracy}%`
    )
    .join("\n");

  return [
    `当前课次：第 ${lessonId} 課`,
    `当前模块：${module}`,
    `本课掌握度：单词 ${lessonProgress.vocabulary}% / 语法 ${lessonProgress.grammar}% / 课文 ${lessonProgress.text}% / 例句 ${lessonProgress.examples}% / 听力 ${lessonProgress.listening}%`,
    `今日学习时长：${todayMinutes} 分钟`,
    weakItemsText ? `当前薄弱项（压缩后）：\n${weakItemsText}` : "",
    wrongAnswersText ? `最近错题（当前课次与模块）：\n${wrongAnswersText}` : "",
    recentQuizText ? `最近测验：\n${recentQuizText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLocalConversationSummary(messages: Array<{ role: string; content: string }>) {
  if (messages.length === 0) return "";

  return messages
    .slice(-6)
    .map((message) =>
      message.role === "user"
        ? `- 学习者提问：${truncate(message.content, 70)}`
        : `- 助手回答：${truncate(message.content, 90)}`
    )
    .join("\n");
}

async function ensureConversationSummary(
  conversationId: number,
  recentTurns: number,
  summarizeEveryTurns: number
) {
  const allMessages = await listConversationMessages(conversationId);
  const recentMessageLimit = Math.max(2, recentTurns * 2);
  const olderMessages = allMessages.slice(0, -recentMessageLimit);

  if (olderMessages.length < Math.max(2, summarizeEveryTurns * 2)) {
    return "";
  }

  const summary = buildLocalConversationSummary(olderMessages);
  if (!summary) return "";

  await upsertConversationSummary({
    conversationId,
    summary,
    messageCount: olderMessages.length,
  });

  return summary;
}

function buildTutorSystemPrompt({
  settings,
  lessonId,
  module,
  learnerSnapshot,
  moduleContext,
  conversationSummary,
  longTermMemories,
  requestShapeHint,
}: {
  settings: AISettings["tutor"];
  lessonId: number;
  module: Module;
  learnerSnapshot: string;
  moduleContext: string;
  conversationSummary: string;
  longTermMemories: string[];
  requestShapeHint: string;
}) {
  return [
    BASE_TUTOR_SAFETY_PROMPT,
    TUTOR_RESPONSE_STYLE_PROMPT,
    `你的名字是「${settings.assistantName}」。你正在服务一位独立学习者，请记住你是这个产品内的专属日语老师。`,
    buildTeachingStyleText(settings),
    settings.customTutorPrompt
      ? `个性化导师要求：\n${settings.customTutorPrompt}`
      : "",
    `当前实时上下文：第 ${lessonId} 課 / ${module}`,
    learnerSnapshot ? `学习者快照：\n${learnerSnapshot}` : "",
    moduleContext
      ? `当前课次内容摘要（仅供回答参考，不必逐条复述）：\n${moduleContext}`
      : "",
    conversationSummary ? `较早对话摘要：\n${conversationSummary}` : "",
    longTermMemories.length > 0
      ? `长期记忆（压缩后）：\n${longTermMemories.map((item) => `- ${item}`).join("\n")}`
      : "",
    requestShapeHint ? `本轮输出形态要求：\n${requestShapeHint}` : "",
    "回答要求：优先结合当前课次、当前模块和学习者真实进度回答；不要假装记得系统未提供的信息；若学习者是在追问上一个结果，请尽量在原结果基础上补充，而不是完全换一种答案；当用户没有要求细讲时，宁可短一些，也不要自行展开成长篇讲解。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildRequestShapeHint(messages: AIMessage[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (!latestUserMessage) return "";

  const normalized = latestUserMessage.toLowerCase();
  const wantsTable =
    normalized.includes("表格") ||
    normalized.includes("markdown表格") ||
    normalized.includes("table");
  const wantsList =
    normalized.includes("列表") ||
    normalized.includes("列出") ||
    normalized.includes("只要词汇") ||
    normalized.includes("只要单词") ||
    normalized.includes("简单列表") ||
    normalized.includes("简单列") ||
    normalized.includes("只列");
  const wantsBrief =
    normalized.includes("简短") ||
    normalized.includes("简单") ||
    normalized.includes("精简") ||
    normalized.includes("简洁") ||
    normalized.includes("不要展开") ||
    normalized.includes("不用展开") ||
    normalized.includes("不要详细") ||
    normalized.includes("不用详细");

  if (wantsTable && wantsBrief) {
    return "学习者本轮明确要求使用真正的 Markdown 表格输出，并保持列数尽量少、每个单元格内容尽量短，不要在表格后继续逐项展开讲解。";
  }

  if (wantsTable) {
    return "学习者本轮明确要求使用真正的 Markdown 表格输出。请直接输出标准 Markdown 表格，不要改成普通段落或伪表格。除非被要求，否则不要在表格后继续展开成长篇解释。";
  }

  if (wantsList && wantsBrief) {
    return "学习者本轮只需要简短列表。请直接给短列表，不要转成表格，也不要给每个条目逐项详解。";
  }

  if (wantsList) {
    return "学习者本轮优先要列表结果。请先给清单式答案，避免冗长解释。";
  }

  if (wantsBrief) {
    return "学习者本轮希望回答简短。请控制篇幅，只保留最必要的信息。";
  }

  return "";
}

export async function buildTutorConversationMessages({
  conversationId,
  lessonId,
  module,
}: {
  conversationId: number;
  lessonId: number;
  module: Module;
}) {
  const settings = normalizeAISettings(await loadSecureAISettings());
  const { recentMessages, summary } = await getConversationContext(
    conversationId,
    settings.tutor.memoryPolicy.recentTurns
  );
  const [learnerSnapshot, longTermMemories, fallbackSummary] =
    await Promise.all([
      buildLearnerSnapshotText(lessonId, module, settings.tutor),
      listRelevantLongTermMemories(
        settings.tutor.memoryPolicy.maxLongTermMemoriesPerRequest
      ),
      ensureConversationSummary(
        conversationId,
        settings.tutor.memoryPolicy.recentTurns,
        settings.tutor.memoryPolicy.summarizeEveryTurns
      ),
    ]);

  const moduleContext = buildModuleContextText(
    lessonId,
    module,
    settings.tutor.memoryPolicy.moduleContextItemsLimit
  );
  const requestShapeHint = buildRequestShapeHint(recentMessages);

  const systemPrompt = buildTutorSystemPrompt({
    settings: settings.tutor,
    lessonId,
    module,
    learnerSnapshot,
    moduleContext,
    conversationSummary: summary?.summary || fallbackSummary,
    longTermMemories: longTermMemories.map((item) => item.text),
    requestShapeHint,
  });

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  ];

  return {
    settings,
    messages,
  };
}

export async function streamTutorReply(
  {
    conversationId,
    lessonId,
    module,
  }: {
    conversationId: number;
    lessonId: number;
    module: Module;
  },
  onDelta?: (chunk: string, fullText: string) => void
) {
  const { messages } = await buildTutorConversationMessages({
    conversationId,
    lessonId,
    module,
  });

  return streamAIText(messages, onDelta);
}
