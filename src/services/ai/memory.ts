"use client";

import type {
  AIConversation,
  AIConversationMessage,
  AIConversationRole,
  AIConversationSummary,
  AILongTermMemory,
  Module,
} from "@/types";
import { db } from "@/services/db";

const ACTIVE_CONVERSATION_KEY = "jpquiz-active-ai-conversation";
export const LOCAL_AI_OWNER_ID = "local-default";

function getStoredActiveConversationId() {
  if (typeof window === "undefined") return null;

  const rawValue = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function persistActiveConversationId(conversationId: number | null) {
  if (typeof window === "undefined") return;

  if (conversationId === null) {
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_CONVERSATION_KEY, String(conversationId));
}

function buildConversationTitle(module: Module, lessonId: number) {
  return `第 ${lessonId} 課 ${module} 对话`;
}

function deriveTitleFromMessage(content: string) {
  const condensed = content.replace(/\s+/g, " ").trim();
  return condensed.length > 18 ? `${condensed.slice(0, 18)}...` : condensed;
}

export async function getConversationById(conversationId: number) {
  return db.aiConversations.get(conversationId);
}

export async function listConversationMessages(conversationId: number) {
  return db.aiMessages
    .where("conversationId")
    .equals(conversationId)
    .sortBy("createdAt");
}

export async function getConversationSummary(conversationId: number) {
  return db.aiConversationSummaries
    .where("conversationId")
    .equals(conversationId)
    .last();
}

export async function getActiveConversation() {
  const activeConversationId = getStoredActiveConversationId();
  if (!activeConversationId) return null;

  const conversation = await db.aiConversations.get(activeConversationId);
  if (!conversation) {
    persistActiveConversationId(null);
    return null;
  }

  return conversation;
}

export async function createConversation({
  lessonId,
  module,
  title,
}: {
  lessonId: number;
  module: Module;
  title?: string;
}) {
  const now = new Date().toISOString();
  const conversation: AIConversation = {
    ownerId: LOCAL_AI_OWNER_ID,
    title: title?.trim() || buildConversationTitle(module, lessonId),
    lessonId,
    module,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  const conversationId = await db.aiConversations.add(conversation);
  persistActiveConversationId(conversationId);

  return {
    ...conversation,
    id: conversationId,
  } satisfies AIConversation;
}

export async function startNewConversation({
  lessonId,
  module,
}: {
  lessonId: number;
  module: Module;
}) {
  return createConversation({ lessonId, module });
}

export async function getOrCreateActiveConversation({
  lessonId,
  module,
}: {
  lessonId: number;
  module: Module;
}) {
  const activeConversation = await getActiveConversation();
  if (activeConversation) {
    return activeConversation;
  }

  return createConversation({ lessonId, module });
}

export async function appendConversationMessage({
  conversationId,
  role,
  content,
}: {
  conversationId: number;
  role: AIConversationRole;
  content: string;
}) {
  const now = new Date().toISOString();
  const trimmedContent = content.trim();
  const message: AIConversationMessage = {
    conversationId,
    ownerId: LOCAL_AI_OWNER_ID,
    role,
    content: trimmedContent,
    createdAt: now,
  };

  const messageId = await db.aiMessages.add(message);
  const currentConversation = await db.aiConversations.get(conversationId);
  const nextTitle =
    currentConversation &&
    currentConversation.title ===
      buildConversationTitle(currentConversation.module, currentConversation.lessonId) &&
    role === "user"
      ? deriveTitleFromMessage(trimmedContent) || currentConversation.title
      : currentConversation?.title;

  await db.aiConversations.update(conversationId, {
    updatedAt: now,
    lastMessageAt: now,
    ...(nextTitle ? { title: nextTitle } : {}),
  });

  return {
    ...message,
    id: messageId,
  } satisfies AIConversationMessage;
}

export async function getConversationContext(
  conversationId: number,
  recentTurns: number
) {
  const [summary, messages] = await Promise.all([
    getConversationSummary(conversationId),
    listConversationMessages(conversationId),
  ]);

  const messageLimit = Math.max(2, recentTurns * 2);

  return {
    summary,
    recentMessages: messages.slice(-messageLimit),
  };
}

export async function upsertConversationSummary({
  conversationId,
  summary,
  messageCount,
}: {
  conversationId: number;
  summary: string;
  messageCount: number;
}) {
  const existing = await db.aiConversationSummaries
    .where("conversationId")
    .equals(conversationId)
    .last();
  const now = new Date().toISOString();

  if (existing?.id) {
    await db.aiConversationSummaries.update(existing.id, {
      summary,
      messageCount,
      updatedAt: now,
    });
    return {
      ...existing,
      summary,
      messageCount,
      updatedAt: now,
    } satisfies AIConversationSummary;
  }

  const record: AIConversationSummary = {
    conversationId,
    ownerId: LOCAL_AI_OWNER_ID,
    summary,
    messageCount,
    updatedAt: now,
  };
  const id = await db.aiConversationSummaries.add(record);

  return {
    ...record,
    id,
  } satisfies AIConversationSummary;
}

export async function listRelevantLongTermMemories(limit: number) {
  if (limit <= 0) return [];

  const memories = await db.aiLongTermMemories
    .where("ownerId")
    .equals(LOCAL_AI_OWNER_ID)
    .toArray();

  return memories
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .slice(0, limit) as AILongTermMemory[];
}

export function clearActiveConversationSelection() {
  persistActiveConversationId(null);
}
