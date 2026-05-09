"use client";

import type {
  AIConversation,
  AIConversationMessage,
  AIConversationRole,
  AIConversationSummary,
  AILongTermMemory,
  Module,
} from "@/types";
import { getCurrentUserId } from "@/services/account";

function activeConversationKey() {
  return `jpquiz-${getCurrentUserId()}-active-ai-conversation`;
}
/** @deprecated Use getCurrentUserId() instead */
export const LOCAL_AI_OWNER_ID = "local-default";

function getStoredActiveConversationId() {
  if (typeof window === "undefined") return null;

  const rawValue = localStorage.getItem(activeConversationKey());
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function persistActiveConversationId(conversationId: number | null) {
  if (typeof window === "undefined") return;

  if (conversationId === null) {
    localStorage.removeItem(activeConversationKey());
    return;
  }

  localStorage.setItem(activeConversationKey(), String(conversationId));
}

function buildConversationTitle(module: Module, lessonId: number) {
  return `第 ${lessonId} 課 ${module} 对话`;
}

function deriveTitleFromMessage(content: string) {
  const condensed = content.replace(/\s+/g, " ").trim();
  return condensed.length > 18 ? `${condensed.slice(0, 18)}...` : condensed;
}

export async function getConversationById(conversationId: number): Promise<AIConversation | undefined> {
  const res = await fetch(`/api/db/ai/conversation/get?id=${conversationId}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data || undefined;
}

export async function listConversationMessages(conversationId: number): Promise<AIConversationMessage[]> {
  const res = await fetch(`/api/db/ai/messages/list?conversationId=${conversationId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getConversationSummary(conversationId: number): Promise<AIConversationSummary | undefined> {
  const res = await fetch(`/api/db/ai/summary/get?conversationId=${conversationId}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data || undefined;
}

export async function getActiveConversation(): Promise<AIConversation | null> {
  const activeConversationId = getStoredActiveConversationId();
  if (!activeConversationId) return null;

  const conversation = await getConversationById(activeConversationId);
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
}): Promise<AIConversation> {
  const res = await fetch("/api/db/ai/conversation/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title?.trim() || buildConversationTitle(module, lessonId),
      lessonId,
      module,
    }),
  });
  const conversation: AIConversation = await res.json();
  if (conversation.id) {
    persistActiveConversationId(conversation.id);
  }
  return conversation;
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
}): Promise<AIConversationMessage> {
  const now = new Date().toISOString();
  const trimmedContent = content.trim();

  // Append message
  const msgRes = await fetch("/api/db/ai/messages/append", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      role,
      content: trimmedContent,
      createdAt: now,
    }),
  });
  const message: AIConversationMessage = await msgRes.json();

  // Update conversation metadata
  const currentConversation = await getConversationById(conversationId);
  const nextTitle =
    currentConversation &&
    currentConversation.title ===
      buildConversationTitle(currentConversation.module, currentConversation.lessonId) &&
    role === "user"
      ? deriveTitleFromMessage(trimmedContent) || currentConversation.title
      : currentConversation?.title;

  await fetch("/api/db/ai/conversation/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      updatedAt: now,
      lastMessageAt: now,
      ...(nextTitle ? { title: nextTitle } : {}),
    }),
  });

  return message;
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
}): Promise<AIConversationSummary> {
  const res = await fetch("/api/db/ai/summary/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, summary, messageCount }),
  });
  return res.json();
}

export async function listRelevantLongTermMemories(limit: number): Promise<AILongTermMemory[]> {
  if (limit <= 0) return [];

  const res = await fetch("/api/db/ai/memories/list");
  if (!res.ok) return [];
  const memories: AILongTermMemory[] = await res.json();
  return memories.slice(0, limit);
}

export function clearActiveConversationSelection() {
  persistActiveConversationId(null);
}
