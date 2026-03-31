"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import AIInputBar from "./AIInputBar";
import AIResponsePanel from "./AIResponsePanel";
import type { AIConversationMessage } from "@/types";
import { useLessonStore } from "@/stores/lessonStore";
import {
  appendConversationMessage,
  getActiveConversation,
  getConversationById,
  listConversationMessages,
  startNewConversation,
  getOrCreateActiveConversation,
} from "@/services/ai/memory";
import { streamTutorReply } from "@/services/ai/tutor";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationMessages, setConversationMessages] = useState<
    AIConversationMessage[]
  >([]);
  const { currentLesson, currentModule, hydrate, hydrated } = useLessonStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    void (async () => {
      const activeConversation = await getActiveConversation();
      if (!activeConversation?.id || cancelled) return;

      const messages = await listConversationMessages(activeConversation.id);
      if (cancelled) return;

      setConversationId(activeConversation.id);
      setConversationTitle(activeConversation.title);
      setConversationMessages(messages);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const handleAISend = useCallback(async (message: string) => {
    setAiLoading(true);
    setShowPanel(true);
    const now = new Date().toISOString();
    const pendingAssistantMessage: AIConversationMessage = {
      conversationId: conversationId || 0,
      ownerId: "local-default",
      role: "assistant",
      content: "",
      createdAt: now,
    };

    try {
      const activeConversation =
        conversationId !== null
          ? await getConversationById(conversationId)
          : null;
      const conversation =
        activeConversation ||
        (await getOrCreateActiveConversation({
          lessonId: currentLesson,
          module: currentModule,
        }));

      if (!conversation.id) {
        throw new Error("当前对话初始化失败。");
      }

      const userMessage = await appendConversationMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
      });
      const latestConversation = await getConversationById(conversation.id);

      setConversationId(conversation.id);
      setConversationTitle(latestConversation?.title || conversation.title);
      setConversationMessages((prev) => [
        ...prev,
        userMessage,
        { ...pendingAssistantMessage, conversationId: conversation.id },
      ]);

      const fullText = await streamTutorReply(
        {
          conversationId: conversation.id,
          lessonId: currentLesson,
          module: currentModule,
        },
        (_, nextText) => {
          setConversationMessages((prev) => {
            if (prev.length === 0) return prev;

            const nextMessages = [...prev];
            const lastIndex = nextMessages.length - 1;
            const lastMessage = nextMessages[lastIndex];
            if (
              lastMessage &&
              lastMessage.role === "assistant" &&
              !lastMessage.id
            ) {
              nextMessages[lastIndex] = {
                ...lastMessage,
                content: nextText,
              };
            }
            return nextMessages;
          });
        }
      );

      const resolvedText =
        fullText || "AI 未返回有效内容，请检查 API Key 和模型配置是否正确。";
      const assistantMessage = await appendConversationMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: resolvedText,
      });

      setConversationMessages((prev) => {
        if (prev.length === 0) return [assistantMessage];

        const nextMessages = [...prev];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.id
        ) {
          nextMessages[lastIndex] = assistantMessage;
          return nextMessages;
        }

        return [...nextMessages, assistantMessage];
      });

      if (!fullText) {
        return;
      }
    } catch (err) {
      const errorMessage = `错误: ${
        err instanceof Error ? err.message : "未知错误"
      }`;

      setConversationMessages((prev) => {
        if (prev.length === 0) {
          return [
            {
              ...pendingAssistantMessage,
              conversationId: conversationId || 0,
              content: errorMessage,
            },
          ];
        }

        const nextMessages = [...prev];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.id
        ) {
          nextMessages[lastIndex] = {
            ...lastMessage,
            content: errorMessage,
          };
          return nextMessages;
        }

        return [
          ...nextMessages,
          {
            ...pendingAssistantMessage,
            conversationId: conversationId || 0,
            content: errorMessage,
          },
        ];
      });
    } finally {
      setAiLoading(false);
    }
  }, [conversationId, currentLesson, currentModule]);

  const handleNewConversation = useCallback(async () => {
    const conversation = await startNewConversation({
      lessonId: currentLesson,
      module: currentModule,
    });

    setConversationId(conversation.id || null);
    setConversationTitle(conversation.title);
    setConversationMessages([]);
    setShowPanel(true);
  }, [currentLesson, currentModule]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>

        {/* AI Response Panel - between content and input bar */}
        {showPanel && (
          <AIResponsePanel
            title={conversationTitle}
            messages={conversationMessages}
            loading={aiLoading}
            lessonId={currentLesson}
            module={currentModule}
            onNewConversation={handleNewConversation}
            onClose={() => {
              setShowPanel(false);
            }}
          />
        )}

        <AIInputBar onSend={handleAISend} loading={aiLoading} />
      </div>
    </div>
  );
}
